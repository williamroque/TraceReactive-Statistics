import { BaseNode } from '@tracereactive/types';
import { InferentialCategory } from '../../categories';
import * as aq from 'arquero';
import { jStat } from 'jstat';

export class AnovaNode extends BaseNode {
    readonly category = InferentialCategory;
    readonly typeId = 'stats:anova';
    readonly displayName = 'ANOVA';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'AnovaTable', outputType: 'core:dataframe' },
        { name: 'F_stat', outputType: 'core:number' },
        { name: 'p_value', outputType: 'core:number' }
    ];
    
    readonly properties = [
        { name: 'dependentCol', label: 'Dependent Column', type: 'text' as const, defaultValue: '' },
        { name: 'factorCols', label: 'Factor Column', type: 'text' as const, defaultValue: '' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const depCol = properties['dependentCol'] as string;
        const facCol = properties['factorCols'] as string;
        
        if (!depCol || !facCol || !table.columnNames().includes(depCol) || !table.columnNames().includes(facCol)) return {};
        
        const groups: Record<string, number[]> = {};
        
        const depArr = Array.from(table.array(depCol));
        const facArr = Array.from(table.array(facCol));
        
        for (let i = 0; i < depArr.length; i++) {
            const v = depArr[i];
            const f = String(facArr[i]);
            if (typeof v === 'number' && !isNaN(v) && facArr[i] != null) {
                if (!groups[f]) groups[f] = [];
                groups[f].push(v);
            }
        }
        
        const groupArrays = Object.values(groups).filter(g => g.length > 0);
        if (groupArrays.length < 2) return {};
        
        const fStat = jStat.anovaftest(...groupArrays);
        
        let totalN = 0;
        let k = groupArrays.length;
        groupArrays.forEach(g => totalN += g.length);
        const df1 = k - 1;
        const df2 = totalN - k;
        
        const pValue = 1 - jStat.centralF.cdf(fStat, df1, df2);
        
        const summary = aq.from([{
            test: 'One-Way ANOVA',
            f_stat: fStat,
            p_value: pValue,
            df1: df1,
            df2: df2
        }]);
        
        return { AnovaTable: summary, F_stat: fStat, p_value: pValue };
    }
}
