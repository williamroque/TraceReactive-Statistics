import { BaseNode } from '@tracereactive/types';
import { InferentialCategory } from '../../categories';
import * as aq from 'arquero';
import { jStat } from 'jstat';

export class NormalityTestNode extends BaseNode {
    readonly category = InferentialCategory;
    readonly typeId = 'stats:normality';
    readonly displayName = 'Normality Test';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Summary', outputType: 'core:dataframe' },
        { name: 'Statistic', outputType: 'core:number' },
        { name: 'P-Value', outputType: 'core:number' }
    ];
    
    readonly properties = [
        { name: 'column', label: 'Column', type: 'string' as const, defaultValue: '' },
        { name: 'method', label: 'Method', type: 'select' as const, options: [{ label: 'Jarque-Bera', value: 'Jarque-Bera' }], defaultValue: 'Jarque-Bera' }
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
        
        const data = Array.from(table.array(col) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
        const n = data.length;
        if (n < 4) return {};
        
        const skew = jStat.skewness(data);
        const kurt = jStat.kurtosis(data); // excess kurtosis
        
        const jb = (n / 6) * (skew * skew + 0.25 * kurt * kurt);
        const p_value = 1 - jStat.chisquare.cdf(jb, 2);
        
        const summary = aq.from([{
            Test: 'Jarque-Bera',
            Statistic: jb,
            'P-Value': p_value
        }]);
        
        return { Summary: summary, Statistic: jb, 'P-Value': p_value };
    }
}
