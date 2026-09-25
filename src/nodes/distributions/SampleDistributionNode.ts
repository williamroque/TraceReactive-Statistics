import { BaseNode } from '@tracereactive/types';
import { DistributionsCategory } from '../../categories';
import * as aq from 'arquero';

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
        { name: 'distribution', label: 'Distribution', type: 'select' as const, options: [{ label: 'Normal', value: 'Normal' }, { label: 'Uniform', value: 'Uniform' }, { label: 'Binomial', value: 'Binomial' }, { label: 'Poisson', value: 'Poisson' }], defaultValue: 'Normal' },
        { name: 'n', label: 'Sample Size', type: 'number' as const, defaultValue: 100 },
        { name: 'param1', label: 'Param 1 (Mean/Min/n/lambda)', type: 'number' as const, defaultValue: 0 },
        { name: 'param2', label: 'Param 2 (Std/Max/p)', type: 'number' as const, defaultValue: 1 },
        { name: 'seed', label: 'Random Seed', type: 'number' as const, defaultValue: 42 }
    ];

    private seededRandom(seed: number) {
        let current = seed;
        return function() {
            current = (current * 9301 + 49297) % 233280;
            return current / 233280;
        };
    }

    private boxMuller(rand1: number, rand2: number): number {
        const u1 = rand1;
        const u2 = rand2;
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0;
    }

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const dist = properties['distribution'] as string;
        let n = Number(properties['n']);
        if (isNaN(n) || n < 1) n = 100;
        
        const p1 = Number(properties['param1']) || 0;
        const p2 = Number(properties['param2']) || (dist === 'Normal' || dist === 'Uniform' ? 1 : 0.5);
        
        let seed = Number(properties['seed']);
        if (isNaN(seed)) seed = 42;
        
        const rng = this.seededRandom(seed);
        
        const values = [];
        
        if (dist === 'Normal') {
            for (let i = 0; i < n; i++) {
                const z = this.boxMuller(rng() || 0.0001, rng() || 0.0001);
                values.push(p1 + z * p2); // p1 = mean, p2 = std
            }
        } 
        else if (dist === 'Uniform') {
            for (let i = 0; i < n; i++) {
                values.push(p1 + rng() * (p2 - p1)); // p1 = min, p2 = max
            }
        }
        else if (dist === 'Binomial') {
            const trials = Math.max(1, Math.floor(p1));
            const p = Math.max(0, Math.min(1, p2));
            for (let i = 0; i < n; i++) {
                let successes = 0;
                for (let t = 0; t < trials; t++) {
                    if (rng() < p) successes++;
                }
                values.push(successes);
            }
        }
        else if (dist === 'Poisson') {
            const L = Math.exp(-p1);
            for (let i = 0; i < n; i++) {
                let k = 0;
                let p = 1;
                do {
                    k++;
                    p *= rng();
                } while (p > L && k < 1000);
                values.push(k - 1);
            }
        }
        
        return { Data: aq.table({ value: values }) };
    }
}
