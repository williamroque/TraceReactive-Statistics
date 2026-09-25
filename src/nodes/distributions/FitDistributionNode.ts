import { BaseNode } from '@tracereactive/types';
import { DistributionsCategory } from '../../categories';
import * as aq from 'arquero';
import { jStat } from 'jstat';

export class FitDistributionNode extends BaseNode {
    readonly category = DistributionsCategory;
    readonly typeId = 'stats:fit_dist';
    readonly displayName = 'Fit Distribution';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Parameters', outputType: 'core:dataframe' },
        { name: 'Fitted Curve', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'column', label: 'Column', type: 'text' as const, defaultValue: '' },
        { name: 'distribution', label: 'Distribution', type: 'select' as const, options: [{ label: 'Normal', value: 'Normal' }, { label: 'Poisson', value: 'Poisson' }, { label: 'Exponential', value: 'Exponential' }, { label: 'Gamma', value: 'Gamma' }], defaultValue: 'Normal' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const col = properties['column'] as string;
        if (!col || !table.columnNames().includes(col)) return {};
        
        const dist = properties['distribution'] as string;
        
        const arr = Array.from(table.array(col) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
        if (arr.length === 0) return {};
        
        const params: any = {};
        
        let min = jStat.min(arr);
        let max = jStat.max(arr);
        let mean = jStat.mean(arr);
        let std = jStat.stdev(arr, true);
        
        if (dist === 'Normal') {
            params.mean = mean;
            params.std = std;
        } else if (dist === 'Poisson') {
            params.lambda = mean;
        } else if (dist === 'Exponential') {
            params.rate = 1 / mean;
        } else if (dist === 'Gamma') {
            const variance = std * std;
            params.shape = (mean * mean) / variance;
            params.scale = variance / mean;
        }
        
        const curvePoints = 100;
        const curveData = [];
        const step = (max - min) / (curvePoints - 1);
        
        for (let i = 0; i < curvePoints; i++) {
            const x = min + i * step;
            let y = 0;
            if (dist === 'Normal') {
                y = jStat.normal.pdf(x, params.mean, params.std);
            } else if (dist === 'Exponential') {
                y = jStat.exponential.pdf(x, params.rate);
            } else if (dist === 'Gamma') {
                y = jStat.gamma.pdf(x, params.shape, params.scale);
            } else if (dist === 'Poisson') {
                const k = Math.round(x);
                y = jStat.poisson.pdf(k, params.lambda);
            }
            curveData.push({ x, y });
        }
        
        return { 
            Parameters: aq.from([params]),
            'Fitted Curve': aq.from(curveData)
        };
    }
}
