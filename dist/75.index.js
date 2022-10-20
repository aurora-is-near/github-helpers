"use strict";
exports.id = 75;
exports.ids = [75];
exports.modules = {

/***/ 7075:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "GenerateComponentMatrix": () => (/* binding */ GenerateComponentMatrix),
  "generateComponentMatrix": () => (/* binding */ generateComponentMatrix)
});

// EXTERNAL MODULE: ./node_modules/@actions/core/lib/core.js
var core = __webpack_require__(2186);
// EXTERNAL MODULE: ./src/types/generated.ts
var generated = __webpack_require__(3476);
// EXTERNAL MODULE: ./node_modules/@actions/github/lib/github.js
var github = __webpack_require__(5438);
// EXTERNAL MODULE: ./src/octokit.ts
var octokit = __webpack_require__(6161);
;// CONCATENATED MODULE: ./src/utils/get-changed-files.ts
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};



var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["add"] = 0] = "add";
    ChangeType[ChangeType["edit"] = 1] = "edit";
    ChangeType[ChangeType["delete"] = 2] = "delete";
    ChangeType[ChangeType["any"] = 3] = "any";
})(ChangeType || (ChangeType = {}));
function getChangedFiles(eventName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!eventName) {
            return [];
        }
        switch (eventName) {
            case 'push':
                return getChangesFromSha();
            default:
                return getChangesFromPR();
        }
    });
}
function getChangesFromSha() {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const beforeSha = github.context.payload.before;
        const afterSha = github.context.payload.after;
        const owner = (_b = (_a = github.context.payload.repository) === null || _a === void 0 ? void 0 : _a.owner) === null || _b === void 0 ? void 0 : _b.name;
        const repo = (_c = github.context.payload.repository) === null || _c === void 0 ? void 0 : _c.name;
        if (!beforeSha || !afterSha || !repo || !owner) {
            return [];
        }
        const changedFiles = yield octokit/* octokit.repos.compareCommits */.K.repos.compareCommits({
            owner,
            repo,
            base: beforeSha,
            head: afterSha,
            mediaType: { format: 'sha' }
        });
        const changes = changedFiles.data.files.map(f => ({
            file: f.filename,
            changeType: parseStatus(f.status),
            patch: f.patch
        }));
        core.debug('found changed files:');
        for (const change of changes) {
            core.debug(`  ${change.file}`);
        }
        return changes;
    });
}
function getChangesFromPR() {
    return __awaiter(this, void 0, void 0, function* () {
        const pullRequest = github.context.payload.pull_request;
        if (!pullRequest) {
            return [];
        }
        const listFilesResponse = yield octokit/* octokit.pulls.listFiles */.K.pulls.listFiles({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: pullRequest.number
        });
        const changes = listFilesResponse.data.map(f => ({
            file: f.filename,
            changeType: parseStatus(f.status),
            patch: f.patch
        }));
        core.debug('found changed files:');
        for (const change of changes) {
            core.debug(`  ${change.file}`);
        }
        return changes;
    });
}
function parseStatus(status) {
    switch (status) {
        case 'added':
            return ChangeType.add;
        case 'removed':
            return ChangeType.delete;
        case 'modified':
            return ChangeType.edit;
        default:
            return ChangeType.edit;
    }
}

// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(1017);
// EXTERNAL MODULE: external "fs"
var external_fs_ = __webpack_require__(7147);
// EXTERNAL MODULE: ./src/utils/get-backstage-entities.ts
var get_backstage_entities = __webpack_require__(1027);
;// CONCATENATED MODULE: ./src/helpers/generate-component-matrix.ts
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
var generate_component_matrix_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};







class GenerateComponentMatrix extends generated/* HelperInputs */.s {
}
function sourceLocation(entity) {
    if (!entity.metadata.annotations)
        return;
    const loc = entity.metadata.annotations['backstage.io/source-location'];
    return loc;
}
function sourceLocationDir(entity) {
    const loc = sourceLocation(entity);
    return loc.split('/').slice(7, -1).join('/');
}
/**
 * Finds the first parent directory that contains rootFile.
 * If the rootFile is not found, returns ./
 */
function findRoot(fileName, rootFile) {
    const dirs = fileName.split('/');
    core.info(`searching ${rootFile} for ${fileName}`);
    for (;;) {
        const testFile = external_path_.join('./', ...dirs, rootFile);
        core.info(`checking: ${testFile}`);
        if (external_fs_.existsSync(testFile)) {
            core.info(`Found ${rootFile} root for ${fileName}:`);
            core.info(dirs.join('/'));
            break;
        }
        if (dirs.length === 0) {
            core.info(`Unable to find ${rootFile} for ${fileName}, using the default`);
            break;
        }
        // eslint-disable-next-line functional/immutable-data
        dirs.pop();
    }
    return dirs.length > 0 ? dirs.join('/') : '.';
}
const generateComponentMatrix = ({ backstage_url }) => generate_component_matrix_awaiter(void 0, void 0, void 0, function* () {
    const entities = yield (0,get_backstage_entities/* getBackstageEntities */.g)({ backstage_url });
    const repoUrl = `${process.env.GITHUB_SERVER_URL}/${github.context.repo.owner}/${github.context.repo.repo}`;
    const contractItems = entities
        .filter(item => { var _a; return (_a = sourceLocation(item)) === null || _a === void 0 ? void 0 : _a.startsWith(`url:${repoUrl}/`); })
        .filter(item => { var _a; return ((_a = item.spec) === null || _a === void 0 ? void 0 : _a.type) === 'contract'; });
    const contractItemNames = contractItems.map(item => item.metadata.name);
    core.info(`Contract entities in this repo: ${contractItems.length} (${contractItemNames})`);
    const eventName = process.env.GITHUB_EVENT_NAME;
    const changedFiles = yield getChangedFiles(eventName);
    core.info(`Changed files count: ${changedFiles.length}`);
    const changedContracts = contractItems.filter(contractItem => changedFiles.some(file => {
        const loc = sourceLocation(contractItem);
        return file.file.startsWith(loc);
    }));
    core.info(`Changed contracts: ${Object.keys(changedContracts).length} ({${Object.keys(changedContracts)}})`);
    const forceAll = eventName !== 'pull_request';
    if (forceAll)
        core.info('forcing CI runs for all components (not a pull request)');
    core.info('Generating component matrix...');
    const matrix = {
        include: contractItems.map(item => {
            const isSolidity = ['ethereum', 'aurora'].some(tag => item.metadata.tags.includes(tag));
            const isRust = item.metadata.tags.includes('near');
            const runSlither = isSolidity && (forceAll || changedContracts.includes(item));
            const runClippy = isRust && (forceAll || changedContracts.includes(item));
            return {
                name: item.metadata.name,
                tags: item.metadata.tags,
                path: sourceLocationDir(item),
                nodeRoot: findRoot(sourceLocationDir(item), 'package.json'),
                runSlither,
                runClippy
            };
        })
    };
    core.info(JSON.stringify(matrix, null, 2));
    return matrix;
});


/***/ }),

/***/ 6161:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "K": () => (/* binding */ octokit)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2186);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_actions_core__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _adobe_node_fetch_retry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3006);
/* harmony import */ var _adobe_node_fetch_retry__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_adobe_node_fetch_retry__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _actions_github__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(5438);
/* harmony import */ var _actions_github__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_actions_github__WEBPACK_IMPORTED_MODULE_2__);
/*
Copyright 2021 Expedia, Inc.
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



const githubToken = _actions_core__WEBPACK_IMPORTED_MODULE_0__.getInput('github_token', { required: true });
const octokit = (0,_actions_github__WEBPACK_IMPORTED_MODULE_2__.getOctokit)(githubToken, { request: { fetch: _adobe_node_fetch_retry__WEBPACK_IMPORTED_MODULE_1__ } }).rest;


/***/ }),

/***/ 3476:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "s": () => (/* binding */ HelperInputs)
/* harmony export */ });
/*
Copyright 2021 Expedia, Inc.
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
class HelperInputs {
}


/***/ }),

/***/ 1027:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "g": () => (/* binding */ getBackstageEntities)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2186);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_actions_core__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _backstage_catalog_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8988);
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
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};


const getBackstageEntities = ({ backstage_url }) => __awaiter(void 0, void 0, void 0, function* () {
    if (!backstage_url) {
        throw new Error('BACKSTAGE_URL is required, make sure to set the secret');
    }
    _actions_core__WEBPACK_IMPORTED_MODULE_0__.info('Connecting to Backstage to fetch available entities');
    const discoveryApi = {
        getBaseUrl() {
            return __awaiter(this, void 0, void 0, function* () {
                return `${backstage_url}/api/catalog`;
            });
        }
    };
    const catalogClient = new _backstage_catalog_client__WEBPACK_IMPORTED_MODULE_1__/* .CatalogClient */ .MS({
        discoveryApi
    });
    const entities = yield catalogClient.getEntities({});
    _actions_core__WEBPACK_IMPORTED_MODULE_0__.info(`Total backstage entities: ${entities.items.length}`);
    return entities.items;
});


/***/ })

};
;
//# sourceMappingURL=75.index.js.map