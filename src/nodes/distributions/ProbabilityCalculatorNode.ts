import { BaseNode } from '@tracereactive/types';
import { DistributionsCategory } from '../../categories';
import * as aq from 'arquero';
import { jStat } from 'jstat';

export class ProbabilityCalculatorNode extends BaseNode {
    readonly category = DistributionsCategory;
    readonly typeId = 'stats:prob_calc';
    readonly displayName = 'Probability Calculator';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Result', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'distribution', label: 'Distribution', type: 'select' as const, options: [{ label: 'Normal', value: 'Normal' }, { label: 'Uniform', value: 'Uniform' }], defaultValue: 'Normal' },
        { name: 'calculation', label: 'Calculation', type: 'select' as const, options: [{ label: 'PDF/PMF', value: 'PDF/PMF' }, { label: 'CDF', value: 'CDF' }, { label: 'Quantile', value: 'Quantile' }], defaultValue: 'PDF/PMF' },
        { name: 'param1', label: 'Param 1 (Mean/Min)', type: 'number' as const, defaultValue: 0 },
        { name: 'param2', label: 'Param 2 (Std/Max)', type: 'number' as const, defaultValue: 1 },
        { name: 'valueOrCol', label: 'Value/Col', type: 'string' as const, defaultValue: '0' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        const dist = properties['distribution'] as string;
        const calc = properties['calculation'] as string;
        const p1 = Number(properties['param1']) || 0;
        const p2 = Number(properties['param2']) || 1;
        const valueOrCol = properties['valueOrCol'] as string;
        
        const isCol = table && table.columnNames ? table.columnNames().includes(valueOrCol) : false;
        
        if (isCol && table) {
            const outCol = `${valueOrCol}_${calc.replace(/[^a-zA-Z]/g, '').toLowerCase()}`;
            const pdfArr = Array.from(table.array(valueOrCol) as Iterable<number>).map(v => {
                if (typeof v !== 'number' || isNaN(v)) return null;
                if (dist === 'Normal') {
                    if (calc === 'PDF/PMF') return jStat.normal.pdf(v, p1, p2);
                    if (calc === 'CDF') return jStat.normal.cdf(v, p1, p2);
                    if (calc === 'Quantile') return jStat.normal.inv(v, p1, p2);
                } else if (dist === 'Uniform') {
                    if (calc === 'PDF/PMF') return jStat.uniform.pdf(v, p1, p2);
                    if (calc === 'CDF') return jStat.uniform.cdf(v, p1, p2);
                    if (calc === 'Quantile') return jStat.uniform.inv(v, p1, p2);
                }
                return null;
            });
            return { Result: table.assign({ [outCol]: pdfArr }) };
        } else {
            const v = Number(valueOrCol);
            if (isNaN(v)) return { Result: aq.table({}) };
            
            let ans = 0;
            if (dist === 'Normal') {
                if (calc === 'PDF/PMF') ans = jStat.normal.pdf(v, p1, p2);
                if (calc === 'CDF') ans = jStat.normal.cdf(v, p1, p2);
                if (calc === 'Quantile') ans = jStat.normal.inv(v, p1, p2);
            } else if (dist === 'Uniform') {
                if (calc === 'PDF/PMF') ans = jStat.uniform.pdf(v, p1, p2);
                if (calc === 'CDF') ans = jStat.uniform.cdf(v, p1, p2);
                if (calc === 'Quantile') ans = jStat.uniform.inv(v, p1, p2);
            }
            return { Result: aq.from([{ input: v, result: ans }]) };
        }
    }
}
