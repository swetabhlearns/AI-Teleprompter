import { GoogleGenAI, Modality } from '@google/genai';
import {
    GEMINI_LIVE_PRODUCT_LABEL,
    GEMINI_LIVE_RUNTIME_REGISTRY,
    normalizeGeminiLiveError
} from './geminiLive.js';

const modelCache = new WeakMap();

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeLowerText(value) {
    return normalizeText(value).toLowerCase();
}

function bytesToBase64(bytes) {
    const array = bytes instanceof Uint8Array
        ? bytes
        : bytes instanceof ArrayBuffer
            ? new Uint8Array(bytes)
            : bytes?.buffer instanceof ArrayBuffer
                ? new Uint8Array(bytes.buffer)
                : new Uint8Array();

    if (typeof globalThis.Buffer !== 'undefined') {
        return globalThis.Buffer.from(array).toString('base64');
    }

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < array.length; i += chunkSize) {
        binary += String.fromCharCode(...array.subarray(i, i + chunkSize));
    }

    return btoa(binary);
}

function asModelList(response) {
    if (!response) return [];

    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response.models)) {
        return response.models;
    }

    if (Array.isArray(response.items)) {
        return response.items;
    }

    if (Array.isArray(response.data)) {
        return response.data;
    }

    return [response];
}

async function collectListedModels(response) {
    if (!response) return [];

    if (typeof response[Symbol.asyncIterator] === 'function') {
        const models = [];
        for await (const model of response) {
            models.push(model);
        }
        return models;
    }

    if (typeof response[Symbol.iterator] === 'function') {
        return Array.from(response);
    }

    return asModelList(response);
}

function matchesMatchers(model, matchers = []) {
    const name = normalizeLowerText(model?.name);
    const displayName = normalizeLowerText(model?.displayName);
    const version = normalizeLowerText(model?.version);

    return matchers.some((matcher) => {
        if (!(matcher instanceof RegExp)) return false;
        return matcher.test(name) || matcher.test(displayName) || matcher.test(version);
    });
}

function isGeminiLiveCandidate(model, registryEntry) {
    if (!model) return false;

    if (matchesMatchers(model, registryEntry.displayNameMatchers)) {
        return true;
    }

    return matchesMatchers(model, registryEntry.nameMatchers);
}

async function listGeminiModels(ai) {
    if (!ai?.models?.list) {
        throw new Error('Gemini model listing is not available on this client.');
    }

    try {
        const response = await ai.models.list({ config: { pageSize: 200 } });
        return await collectListedModels(response);
    } catch (firstErr) {
        try {
            const response = await ai.models.list({ pageSize: 200 });
            return await collectListedModels(response);
        } catch (secondErr) {
            const message = secondErr?.message || firstErr?.message || 'Failed to list Gemini models';
            throw new Error(message);
        }
    }
}

function pickLiveModel(models, registryEntry) {
    for (const model of models) {
        if (isGeminiLiveCandidate(model, registryEntry)) {
            return model;
        }
    }

    return null;
}

export async function resolveGeminiLiveModel({ ai, registry = GEMINI_LIVE_RUNTIME_REGISTRY } = {}) {
    const client = ai || new GoogleGenAI({});
    const cacheKey = registry?.[0]?.productLabel || GEMINI_LIVE_PRODUCT_LABEL;

    if (modelCache.has(client)) {
        const cached = modelCache.get(client);
        if (cached?.registryKey === cacheKey) {
            if (cached.error) {
                throw cached.error;
            }

            return cached.result;
        }
    }

    const registryEntry = registry.find((entry) => entry.productLabel === GEMINI_LIVE_PRODUCT_LABEL) || registry[0];
    if (!registryEntry) {
        const error = new Error(`${GEMINI_LIVE_PRODUCT_LABEL} is not registered.`);
        modelCache.set(client, { registryKey: cacheKey, error });
        throw error;
    }

    try {
        const models = await listGeminiModels(client);
        const model = pickLiveModel(models, registryEntry);

        if (!model?.name) {
            const error = new Error(`${GEMINI_LIVE_PRODUCT_LABEL} Preview is unavailable in the current Gemini model list.`);
            modelCache.set(client, { registryKey: cacheKey, error });
            throw error;
        }

        const result = {
            productLabel: registryEntry.productLabel,
            apiVersion: registryEntry.apiVersion,
            capabilities: registryEntry.capabilities,
            model: normalizeText(model.name).replace(/^models\//, ''),
            modelName: normalizeText(model.name),
            displayName: normalizeText(model.displayName || registryEntry.productLabel),
            version: normalizeText(model.version || ''),
            rawModel: model
        };

        modelCache.set(client, { registryKey: cacheKey, result });
        return result;
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err || 'Failed to resolve Gemini 3.1 Flash Live model'));
        modelCache.set(client, { registryKey: cacheKey, error });
        throw error;
    }
}

export async function connectGeminiLiveSession({
    ai,
    model,
    config = {},
    callbacks = {}
} = {}) {
    if (!ai?.live?.connect) {
        throw new Error('Gemini 3.1 Flash Live is not available on this client.');
    }

    if (!model) {
        throw new Error(`${GEMINI_LIVE_PRODUCT_LABEL} model resolution is required before connecting.`);
    }

    return ai.live.connect({
        model,
        config: {
            responseModalities: [Modality.AUDIO],
            realtimeInputConfig: {
                automaticActivityDetection: {
                    disabled: false
                }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: config.systemInstruction
        },
        callbacks
    });
}

export function sendGeminiPrompt(session, text) {
    if (!session?.sendRealtimeInput) {
        throw new Error('Gemini 3.1 Flash Live session is not connected.');
    }

    return session.sendRealtimeInput({
        text
    });
}

export function sendGeminiAudioChunk(session, chunk, mimeType = 'audio/pcm;rate=16000') {
    if (!session?.sendRealtimeInput) {
        throw new Error('Gemini 3.1 Flash Live session is not connected.');
    }

    return session.sendRealtimeInput({
        audio: {
            data: bytesToBase64(chunk),
            mimeType
        }
    });
}

export function endGeminiAudioTurn(session) {
    if (!session?.sendRealtimeInput) {
        throw new Error('Gemini 3.1 Flash Live session is not connected.');
    }

    return session.sendRealtimeInput({ audioStreamEnd: true });
}

export function normalizeGeminiLiveClientError(error, fallbackMessage) {
    return normalizeGeminiLiveError(error, fallbackMessage);
}
