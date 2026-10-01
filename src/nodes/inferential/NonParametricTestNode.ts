import { BaseNode } from '@tracereactive/types';
import { InferentialCategory } from '../../categories';
import * as aq from 'arquero';
import { jStat } from 'jstat';

export class NonParametricTestNode extends BaseNode {
    readonly category = InferentialCategory;
    readonly typeId = 'stats:nonparametric';
    readonly displayName = 'Non-Parametric Test';
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
        { name: 'testType', label: 'Test Type', type: 'select' as const, options: [{ label: 'Mann-Whitney U', value: 'Mann-Whitney U' }], defaultValue: 'Mann-Whitney U' },
        { name: 'col1', label: 'Column 1 / Value Column', type: 'string' as const, defaultValue: '' },
        { name: 'col2', label: 'Column 2 (Two-Column Mode)', type: 'string' as const, defaultValue: '' },
        { name: 'groupCol', label: 'Group Column (Optional)', type: 'string' as const, defaultValue: '' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const col1 = properties['col1'] as string;
        const col2 = properties['col2'] as string;
        const groupCol = properties['groupCol'] as string;
        
        if (!col1 || !table.columnNames().includes(col1)) return {};
        
        let arr1: number[] = [];
        let arr2: number[] = [];
        let groupNames: [string, string] | null = null;

        if (groupCol && table.columnNames().includes(groupCol)) {
            const groups: Record<string, number[]> = {};
            const valArr = Array.from(table.array(col1) as Iterable<number>);
            const grpArr = Array.from(table.array(groupCol));

            for (let i = 0; i < valArr.length; i++) {
                const v = valArr[i];
                const g = grpArr[i];
                if (typeof v === 'number' && !isNaN(v) && g != null) {
                    const key = String(g);
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(v);
                }
            }

            const keys = Object.keys(groups);
            if (keys.length < 2) return {};
            groupNames = [keys[0], keys[1]];
            arr1 = groups[keys[0]];
            arr2 = groups[keys[1]];
        } else {
            if (!col2 || !table.columnNames().includes(col2)) return {};
            arr1 = Array.from(table.array(col1) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
            arr2 = Array.from(table.array(col2) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
        }
        
        if (arr1.length === 0 || arr2.length === 0) return {};
        
        const combined = arr1.map(v => ({val: v, group: 1}))
            .concat(arr2.map(v => ({val: v, group: 2})))
            .sort((a,b) => a.val - b.val);
            
        let ranks = new Array(combined.length);
        let i = 0;
        while (i < combined.length) {
            let j = i + 1;
            while (j < combined.length && combined[j].val === combined[i].val) j++;
            let avgRank = (i + 1 + j) / 2;
            for (let k = i; k < j; k++) ranks[k] = avgRank;
            i = j;
        }
        
        let R1 = 0;
        for (let k = 0; k < combined.length; k++) {
            if (combined[k].group === 1) R1 += ranks[k];
        }
        
        const n1 = arr1.length;
        const n2 = arr2.length;
        const N = n1 + n2;
        const U1 = R1 - (n1 * (n1 + 1)) / 2;
        const U2 = n1 * n2 - U1;
        const U = Math.min(U1, U2);
        
        const mU = (n1 * n2) / 2;
        // Ties correction: Σ(tᵢ³ - tᵢ) over all tied groups
        const valueCounts = new Map<number, number>();
        for (const item of combined) valueCounts.set(item.val, (valueCounts.get(item.val) ?? 0) + 1);
        let tiesSum = 0;
        for (const count of valueCounts.values()) tiesSum += count * count * count - count;
        const sigmaU = N <= 1 ? 0 : Math.sqrt(n1 * n2 / 12 * ((N + 1) - tiesSum / (N * (N - 1))));
        const z = sigmaU === 0 ? 0 : (U - mU) / sigmaU;
        const pValue = 2 * jStat.normal.cdf(-Math.abs(z), 0, 1);
        
        const summaryData: Record<string, any> = {
            Test: 'Mann-Whitney U',
            Statistic: U,
            'P-Value': pValue
        };
        if (groupNames) {
            summaryData['Group 1'] = `${groupNames[0]} (n=${arr1.length})`;
            summaryData['Group 2'] = `${groupNames[1]} (n=${arr2.length})`;
        }
        const summary = aq.from([summaryData]);
        
        return { Summary: summary, Statistic: U, 'P-Value': pValue };
    }
}
