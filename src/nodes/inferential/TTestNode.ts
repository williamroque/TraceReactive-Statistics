import { BaseNode } from '@tracereactive/types';
import { InferentialCategory } from '../../categories';
import * as aq from 'arquero';
import * as ss from 'simple-statistics';
import { jStat } from 'jstat';

export class TTestNode extends BaseNode {
    readonly category = InferentialCategory;
    readonly typeId = 'stats:ttest';
    readonly displayName = 'T-Test';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Summary', outputType: 'core:dataframe' },
        { name: 't_stat', outputType: 'core:number' },
        { name: 'p_value', outputType: 'core:number' }
    ];
    
    readonly properties = [
        { name: 'testType', label: 'Test Type', type: 'select' as const, options: ['1-Sample', 'Independent', 'Paired'], defaultValue: 'Independent' },
        { name: 'col1', label: 'Column 1', type: 'text' as const, defaultValue: '' },
        { name: 'col2', label: 'Column 2', type: 'text' as const, defaultValue: '' },
        { name: 'popMean', label: 'Pop Mean (1-Sample)', type: 'number' as const, defaultValue: 0 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const testType = properties['testType'] as string;
        const col1 = properties['col1'] as string;
        const col2 = properties['col2'] as string;
        const popMean = Number(properties['popMean']) || 0;
        
        if (!col1 || !table.columnNames().includes(col1)) return {};
        
        const arr1 = Array.from(table.array(col1) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
        if (arr1.length < 2) return {};
        
        let t = 0;
        let p = 1;
        let df = 0;
        
        if (testType === '1-Sample') {
            t = jStat.tscore(popMean, arr1);
            p = jStat.ttest(t, arr1.length, 2);
            df = arr1.length - 1;
        } else if (testType === 'Independent') {
            if (!col2 || !table.columnNames().includes(col2)) return {};
            const arr2 = Array.from(table.array(col2) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
            if (arr2.length < 2) return {};
            
            t = ss.tTestTwoSample(arr1, arr2) || 0;
            p = jStat.ttest(t, arr1.length + arr2.length, 2);
            df = arr1.length + arr2.length - 2;
        } else if (testType === 'Paired') {
            if (!col2 || !table.columnNames().includes(col2)) return {};
            const arr2 = Array.from(table.array(col2) as Iterable<number>);
            const raw1 = Array.from(table.array(col1) as Iterable<number>);
            
            const diffs = [];
            for (let i = 0; i < raw1.length; i++) {
                if (typeof raw1[i] === 'number' && !isNaN(raw1[i]) && typeof arr2[i] === 'number' && !isNaN(arr2[i])) {
                    diffs.push(raw1[i] - arr2[i]);
                }
            }
            if (diffs.length < 2) return {};
            t = jStat.tscore(0, diffs);
            p = jStat.ttest(t, diffs.length, 2);
            df = diffs.length - 1;
        }
        
        const summary = aq.from([{
            test: testType,
            t_stat: t,
            p_value: p,
            df: df
        }]);
        
        return { Summary: summary, t_stat: t, p_value: p };
    }
}
