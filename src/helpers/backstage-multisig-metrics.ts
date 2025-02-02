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
import { Entity } from '@backstage/catalog-model';

import { MultisigsCollector } from '../core/multisigs-collector';
import { getBackstageEntities } from '../utils/get-backstage-entities';

type MultisigMetricsParams = {
  backstage_url?: string;
};
type KeysByOwner = {
  [owner: string]: Entity[];
};

const configuration = client.createConfiguration();
client.setServerVariables(configuration, {
  site: 'datadoghq.eu'
});
const apiInstance = new v2.MetricsApi(configuration);
const DATADOG_GAUGE_TYPE = 3;
const SIGNER_POLICY_LIMIT_MS = 180 * 86400 * 1000; // amount of days * seconds in day * milliseconds in second

export const backstageMultisigMetrics = async ({ backstage_url }: MultisigMetricsParams) => {
  if (!backstage_url) return;
  const entities = await getBackstageEntities({ backstage_url });

  const multisigsCollector = new MultisigsCollector(entities);

  try {
    const multisigSeries = generateMultisigMetrics(multisigsCollector, backstage_url);
    const signerSeries = generateSignerMetrics(multisigsCollector, backstage_url);
    const keySeries = generateAccessKeyMetrics(multisigsCollector, backstage_url);
    const keyCountByOwnerSeries = generateUserAccessKeyMetrics(multisigsCollector, backstage_url);
    const keyCountByContractSeries = generateContractAccessKeyMetrics(multisigsCollector, backstage_url);
    const deprecatedKeysSeries = generateDeprecatedAccessKeyMetrics(multisigsCollector, backstage_url);
    const unknownAccessKeysSeries = generateUnknownAccessKeyMetrics(multisigsCollector, backstage_url);
    const unknownSignerSeries = generateUnknownSignerMetrics(multisigsCollector, backstage_url);
    const unknownAddressSeries = generateUnknownAddressMetrics(multisigsCollector, backstage_url);
    const inactiveSignerSeries = generateInactiveSignerMetrics(multisigsCollector, backstage_url);
    // const unverifiedContractSeries = generateUnverifiedContractsMetrics(multisigsCollector, backstage_url);
    const data = await Promise.all([
      submitMetrics(multisigSeries),
      submitMetrics(signerSeries),
      submitMetrics(keySeries),
      submitMetrics(keyCountByOwnerSeries),
      submitMetrics(keyCountByContractSeries),
      submitMetrics(deprecatedKeysSeries),
      submitMetrics(unknownAccessKeysSeries),
      submitMetrics(unknownSignerSeries),
      submitMetrics(unknownAddressSeries),
      submitMetrics(inactiveSignerSeries)
      // submitMetrics(unverifiedContractSeries)
    ]);

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
      type: DATADOG_GAUGE_TYPE,
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
      type: DATADOG_GAUGE_TYPE,
      points,
      resources
    };
  });
  return series;
}

function generateUnknownSignerMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const unknownSigners = collector
    .getSigners()
    .filter(entry => entry.signer.metadata.tags?.includes('stub') || entry.signer.metadata.namespace === 'stub');
  const series = unknownSigners.map<v2.MetricSeries>(signer => {
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
    const value = 1;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.signers.unknown',
      type: DATADOG_GAUGE_TYPE,
      points,
      resources
    };
  });
  return series;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateUnverifiedContractsMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const unverifiedContracts = collector.getAllApis().filter(entity => entity.metadata.tags?.includes('unverified'));
  const series = unverifiedContracts.map<v2.MetricSeries>(entity => {
    // entities are typically emitted as API kind,
    // tracking for inconsistencies
    const { kind, metadata } = entity;
    const { name, namespace } = metadata;
    // inferred type is JsonObject, this converts to any
    const spec = JSON.parse(JSON.stringify(entity.spec));
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
    const value = 1;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.reports.unverified=contracts',
      type: DATADOG_GAUGE_TYPE,
      points,
      resources
    };
  });
  return series;
}

function generateUnknownAddressMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const stubAndStateEntities = collector
    .getAllResources()
    .filter(entry => entry.metadata.tags?.includes('stub') && entry.metadata.tags?.includes('contract-state'));
  const series = stubAndStateEntities.map<v2.MetricSeries>(entity => {
    // entities are typically emitted as API kind,
    // tracking for inconsistencies
    const { kind, metadata } = entity;
    const { name, namespace } = metadata;
    // inferred type is JsonObject, this converts to any
    const spec = JSON.parse(JSON.stringify(entity.spec));
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
    const value = 1;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.reports.unknown-addresses',
      type: DATADOG_GAUGE_TYPE,
      points,
      resources
    };
  });
  return series;
}

function generateAccessKeyMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const series = collector.getMultisigAccessKeys().map<v2.MetricSeries>(key => {
    // entities are typically emitted as Resource kind,
    // tracking for inconsistencies
    const { kind, metadata } = key;
    const { name, namespace } = metadata;
    // inferred type is JsonObject, this converts to any
    const spec = JSON.parse(JSON.stringify(key.spec));
    const { owner: rawOwner } = spec;
    const [ownerKind, ownerRef] = rawOwner.split(':');
    const ownerName = ownerRef.split('/')[1];
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
      { type: 'owner', name: ownerName },
      { type: 'ownerKind', name: ownerKind }
    ];
    const value = namespace === 'stub' || ownerKind !== 'user' ? 0 : 1;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.access_keys',
      type: DATADOG_GAUGE_TYPE,
      points,
      resources
    };
  });
  return series;
}

function generateDeprecatedAccessKeyMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const series = collector.getDeprecatedAccessKeys().map<v2.MetricSeries>(key => {
    // entities are typically emitted as Resource kind,
    // tracking for inconsistencies
    const { kind, metadata } = key;
    const { name, namespace } = metadata;
    // inferred type is JsonObject, this converts to any
    const spec = JSON.parse(JSON.stringify(key.spec));
    const { owner: rawOwner } = spec;
    const [ownerKind, ownerRef] = rawOwner.split(':');
    const ownerName = ownerRef.split('/')[1];
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
      { type: 'owner', name: ownerName },
      { type: 'ownerKind', name: ownerKind }
    ];
    const value = ownerKind !== 'user' ? 0 : 1;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.access_keys.deprecated',
      type: DATADOG_GAUGE_TYPE,
      points,
      resources
    };
  });
  return series;
}

function generateUnknownAccessKeyMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const series = collector.getUnknownAccessKeys().map<v2.MetricSeries>(key => {
    // entities are typically emitted as Resource kind,
    // tracking for inconsistencies
    const { kind, metadata } = key;
    const { name, namespace } = metadata;
    // inferred type is JsonObject, this converts to any
    const spec = JSON.parse(JSON.stringify(key.spec));
    const { owner: rawOwner } = spec;
    const [ownerKind, ownerRef] = rawOwner.split(':');
    const ownerName = ownerRef.split('/')[1];
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
      { type: 'owner', name: ownerName },
      { type: 'ownerKind', name: ownerKind }
    ];
    const value = 1;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.access_keys.unknown',
      type: DATADOG_GAUGE_TYPE,
      points,
      resources
    };
  });
  return series;
}

function generateUserAccessKeyMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const series = Object.entries(collector.getAccessKeysPerSigner()).map<v2.MetricSeries>(([signer, entry]) => {
    const spec = JSON.parse(JSON.stringify(entry.signer.spec));
    const { owner } = spec;
    const ownerName = `${owner}/${signer}`;
    const resources = [
      {
        type: 'host',
        name: backstageUrl.split('@')[1]
      },
      { type: 'owner', name: ownerName },
      { type: 'user', name: owner },
      { type: 'signer', name: signer }
    ];
    const value = entry.keys.length;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.access_keys_owned_count',
      type: DATADOG_GAUGE_TYPE,
      points,
      resources
    };
  });
  return series;
}

function generateContractAccessKeyMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const accessKeysPerContract = collector.getContractAccessKeys().reduce<KeysByOwner>((acc, key) => {
    // inferred type is JsonObject, this converts to any
    const spec = JSON.parse(JSON.stringify(key.spec));
    const { owner } = spec;
    return {
      ...acc,
      [owner]: [...(acc[owner] || []), key]
    };
  }, {});
  const series = Object.entries(accessKeysPerContract).map<v2.MetricSeries>(([owner, keys]) => {
    const resources = [
      {
        type: 'host',
        name: backstageUrl.split('@')[1]
      },
      { type: 'owner', name: owner }
    ];
    const value = keys.length;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const points = [{ timestamp, value }];
    return {
      metric: 'backstage.access_keys_by_contract_count',
      type: DATADOG_GAUGE_TYPE,
      points,
      resources
    };
  });
  return series;
}

function generateInactiveSignerMetrics(collector: MultisigsCollector, backstageUrl: string) {
  const series = collector.getSigners().map<v2.MetricSeries>(entity => {
    // entities are typically emitted as API kind,
    // tracking for inconsistencies
    const { kind, metadata } = entity.signer;
    const { name, namespace } = metadata;
    // inferred type is JsonObject, this converts to any
    const spec = JSON.parse(JSON.stringify(entity.signer.spec));
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
    const now = new Date().getTime();
    const isPastThreshold = now - Number(spec.lastSigned) > SIGNER_POLICY_LIMIT_MS;
    const value = isPastThreshold ? 1 : 0;
    const points = [{ timestamp: now, value }];
    return {
      metric: 'backstage.signers.inactive',
      type: DATADOG_GAUGE_TYPE,
      points,
      resources
    };
  });
  return series;
}
