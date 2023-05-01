/*
Copyright 2022 Aurora Labs
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    https://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as core from '@actions/core';
import { client, v2 } from '@datadog/datadog-api-client';

import { MultisigsCollector } from '../core/multisigs-collector';
import { getBackstageEntities } from '../utils/get-backstage-entities';

type MultisigMetricsParams = {
  backstage_url?: string;
};

const configuration = client.createConfiguration();
client.setServerVariables(configuration, {
  site: 'datadoghq.eu'
});
const apiInstance = new v2.MetricsApi(configuration);

export const backstageMultisigMetrics = async ({ backstage_url }: MultisigMetricsParams) => {
  if (!backstage_url) return;
  const entities = await getBackstageEntities({ backstage_url });

  const multisigsCollector = new MultisigsCollector(entities);

  try {
    const multisigSeries = generateMultisigMetrics(multisigsCollector, backstage_url);
    const signerSeries = generateSignerMetrics(multisigsCollector, backstage_url);
    const keySeries = generateAccessKeyMetrics(multisigsCollector, backstage_url);
    const data = await Promise.all([submitMetrics(multisigSeries), submitMetrics(signerSeries), submitMetrics(keySeries)]);

    core.info(`API called successfully. Returned data: ${JSON.stringify(data)}`);
    return data;
  } catch (error: unknown) {
    core.error(error as Error);
  }
};

async function submitMetrics(series: v2.MetricSeries[]) {
  const params = {
    body: {
      series
    }
  };
  core.info(`Data to upload: ${JSON.stringify(params)}`);

  return apiInstance.submitMetrics(params);
}

function generateMultisigMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const series = collector.getMultisigs().map<v2.MetricSeries>(multisig => {
    // entities are typically emitted as API kind,
    // tracking for inconsistencies
    const { kind, metadata } = multisig.entity;
    const { name } = metadata;

    // inferred type is JsonObject, this converts to any
    const spec = JSON.parse(JSON.stringify(multisig.entity.spec));
    const { address, network, networkType, system: rawSystem, owner: rawOwner } = spec;
    const system = rawSystem.split(':')[1];
    const owner = rawOwner.split(':')[1];
    const timestamp = Math.round(new Date(spec.multisig.fetchDate).getTime() / 1000);

    // this tags timeseries with distinguishing
    // properties for filtering purposes
    const resources = [
      {
        type: 'host',
        name: backstageUrl.split('@')[1]
      },
      { type: 'api', name },
      { type: 'address', name: address },
      { type: 'kind', name: kind },
      { type: 'network', name: network },
      { type: 'networkType', name: networkType },
      { type: 'system', name: system },
      { type: 'owner', name: owner }
    ];

    const { version } = spec.multisig;
    // datadog requires point value to be scalar
    const value = parseFloat(version);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.multisigs.version',
      type: 3,
      points,
      resources
    };
  });
  return series;
}

function generateSignerMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const series = collector.getSigners().map<v2.MetricSeries>(signer => {
    // entities are typically emitted as API kind,
    // tracking for inconsistencies
    const { kind, metadata } = signer.signer;
    const { name, namespace } = metadata;
    // inferred type is JsonObject, this converts to any
    const spec = JSON.parse(JSON.stringify(signer.signer.spec));
    const { address, network, networkType, owner: rawOwner } = spec;
    const owner = rawOwner.split(':')[1].split('/')[1];
    // this tags timeseries with distinguishing
    // properties for filtering purposes
    const resources = [
      {
        type: 'host',
        name: backstageUrl.split('@')[1]
      },
      { type: 'kind', name: kind },
      { type: 'name', name },
      { type: 'namespace', name: namespace },
      { type: 'address', name: address },
      { type: 'network', name: network },
      { type: 'networkType', name: networkType },
      { type: 'owner', name: owner }
    ];
    // datadog requires point value to be scalar, 0 means unknown ownership
    const value = namespace === 'stub' ? 0 : 1;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.signers',
      type: 3,
      points,
      resources
    };
  });
  return series;
}

function generateAccessKeyMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const series = collector.getAccessKeys().map<v2.MetricSeries>(key => {
    // entities are typically emitted as API kind,
    // tracking for inconsistencies
    const { kind, metadata } = key;
    const { name, namespace } = metadata;
    // inferred type is JsonObject, this converts to any
    const spec = JSON.parse(JSON.stringify(key.spec));
    const { owner: rawOwner } = spec;
    const owner = rawOwner.split(':')[1].split('/')[1];
    // this tags timeseries with distinguishing
    // properties for filtering purposes
    const resources = [
      {
        type: 'host',
        name: backstageUrl.split('@')[1]
      },
      { type: 'kind', name: kind },
      { type: 'name', name },
      { type: 'namespace', name: namespace },
      { type: 'owner', name: owner }
    ];
    const value = 1;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.access-keys',
      type: 3,
      points,
      resources
    };
  });
  return series;
}
