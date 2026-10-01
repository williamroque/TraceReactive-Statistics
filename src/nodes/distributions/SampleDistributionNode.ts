import { BaseNode } from '@tracereactive/types';
import { DistributionsCategory } from '../../categories';
import * as aq from 'arquero';

// Mulberry32 — high-quality 32-bit PRNG with full period 2^32.
// Orders of magnitude better statistical properties than the previous LCG.
function mulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s += 0x6D2B79F5;
        let z = s;
        z = Math.imul(z ^ (z >>> 15), z | 1);
        z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
        return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
}

// Box-Muller transform: (u1, u2) → standard normal sample
function boxMuller(u1: number, u2: number): number {
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Marsaglia-Tsang squeeze method for Gamma(shape, scale) sampling.
// Handles shape < 1 via the G(1+α) * U^(1/α) reduction.
function sampleGamma(rng: () => number, shape: number, scale: number): number {
    if (shape <= 0 || scale <= 0) return NaN;
    if (shape < 1) {
        return sampleGamma(rng, 1 + shape, scale) * Math.pow(rng() || 1e-10, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
        let x: number, v: number;
        do {
            x = boxMuller(rng() || 1e-10, rng() || 1e-10);
            v = 1 + c * x;
        } while (v <= 0);
        v = v * v * v;
        const u = rng();
        const x2 = x * x;
        if (u < 1 - 0.0331 * x2 * x2) return d * v * scale;
        if (Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) return d * v * scale;
    }
}

export class SampleDistributionNode extends BaseNode {
    readonly category = DistributionsCategory;
    readonly typeId = 'stats:sample_dist';
    readonly displayName = 'Sample Distribution';
    readonly visible = true;

    readonly inputs = [];

    readonly outputs = [
        { name: 'Data', outputType: 'core:dataframe' }
    ];

    readonly properties = [
        { name: 'distribution', label: 'Distribution', type: 'select' as const, options: [
            { label: 'Normal (μ, σ)', value: 'Normal' },
            { label: 'Uniform (min, max)', value: 'Uniform' },
            { label: 'Exponential (rate)', value: 'Exponential' },
            { label: 'Gamma (shape α, scale β)', value: 'Gamma' },
            { label: 'Binomial (n, p)', value: 'Binomial' },
            { label: 'Poisson (λ)', value: 'Poisson' }
        ], defaultValue: 'Normal' },
        { name: 'n', label: 'Sample Size', type: 'number' as const, defaultValue: 100 },
        { name: 'param1', label: 'Param 1 (μ / min / rate / shape / n / λ)', type: 'number' as const, defaultValue: 0 },
        { name: 'param2', label: 'Param 2 (σ / max / scale / p)', type: 'number' as const, defaultValue: 1 },
        { name: 'seed', label: 'Random Seed', type: 'number' as const, defaultValue: 42 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }

        const dist = properties['distribution'] as string;
        let n = Number(properties['n']);
        if (isNaN(n) || n < 1) n = 100;
        n = Math.min(n, 100000); // safety cap

        const p1 = Number(properties['param1']);
        const p2 = Number(properties['param2']) || 1;
        let seed = Number(properties['seed']);
        if (isNaN(seed)) seed = 42;

        const rng = mulberry32(seed);
        const values: number[] = [];

        if (dist === 'Normal') {
            const mean = isNaN(p1) ? 0 : p1;
            const std = Math.max(0, p2);
            for (let i = 0; i < n; i++) {
                values.push(mean + boxMuller(rng() || 1e-10, rng() || 1e-10) * std);
            }
        }
        else if (dist === 'Uniform') {
            const lo = isNaN(p1) ? 0 : p1;
            const hi = p2;
            const range = hi - lo;
            for (let i = 0; i < n; i++) values.push(lo + rng() * range);
        }
        else if (dist === 'Exponential') {
            const rate = Math.max(1e-10, isNaN(p1) ? 1 : p1);
            for (let i = 0; i < n; i++) {
                values.push(-Math.log(rng() || 1e-10) / rate);
            }
        }
        else if (dist === 'Gamma') {
            const shape = Math.max(1e-10, isNaN(p1) ? 1 : p1);
            const scale = Math.max(1e-10, p2);
            for (let i = 0; i < n; i++) values.push(sampleGamma(rng, shape, scale));
        }
        else if (dist === 'Binomial') {
            const trials = Math.max(1, Math.floor(isNaN(p1) ? 1 : p1));
            const prob = Math.max(0, Math.min(1, p2));
            for (let i = 0; i < n; i++) {
                let successes = 0;
                for (let t = 0; t < trials; t++) if (rng() < prob) successes++;
                values.push(successes);
            }
        }
        else if (dist === 'Poisson') {
            const lambda = Math.max(1e-10, isNaN(p1) ? 1 : p1);
            const L = Math.exp(-lambda);
            for (let i = 0; i < n; i++) {
                let k = 0, p = 1;
                do { k++; p *= rng(); } while (p > L && k < 10000);
                values.push(k - 1);
            }
        }

        return { Data: aq.table({ value: values }) };
    }
}
