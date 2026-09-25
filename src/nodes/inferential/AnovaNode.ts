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
        { name: 'Summary', outputType: 'core:dataframe' },
        { name: 'F-Stat', outputType: 'core:number' },
        { name: 'P-Value', outputType: 'core:number' }
    ];
    
    readonly properties = [
        { name: 'dependentCol', label: 'Dependent Column', type: 'string' as const, defaultValue: '' },
        { name: 'factorCols', label: 'Factor Column', type: 'string' as const, defaultValue: '' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
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
            Test: 'One-Way ANOVA',
            'F-Stat': fStat,
            'P-Value': pValue,
            DOF1: df1,
            DOF2: df2
        }]);
        
        return { Summary: summary, AnovaTable: summary, 'F-Stat': fStat, 'P-Value': pValue };
    }
}
