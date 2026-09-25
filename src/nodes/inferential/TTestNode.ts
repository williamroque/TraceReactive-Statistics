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
        { name: 'T-Stat', outputType: 'core:number' },
        { name: 'P-Value', outputType: 'core:number' }
    ];
    
    readonly properties = [
        { name: 'testType', label: 'Test Type', type: 'select' as const, options: [{ label: '1-Sample', value: '1-Sample' }, { label: 'Independent', value: 'Independent' }, { label: 'Paired', value: 'Paired' }], defaultValue: 'Independent' },
        { name: 'col1', label: 'Column 1 / Value Column', type: 'string' as const, defaultValue: '' },
        { name: 'col2', label: 'Column 2 (Two-Column Mode)', type: 'string' as const, defaultValue: '' },
        { name: 'groupCol', label: 'Group Column (Optional)', type: 'string' as const, defaultValue: '' },
        { name: 'popMean', label: 'Pop Mean (1-Sample)', type: 'number' as const, defaultValue: 0 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const testType = properties['testType'] as string;
        const col1 = properties['col1'] as string;
        const col2 = properties['col2'] as string;
        const groupCol = properties['groupCol'] as string;
        const popMean = Number(properties['popMean']) || 0;
        
        if (!col1 || !table.columnNames().includes(col1)) return {};
        
        let arr1: number[] = [];
        let arr2: number[] = [];
        let groupNames: [string, string] | null = null;

        if (testType === 'Independent' && groupCol && table.columnNames().includes(groupCol)) {
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
            arr1 = Array.from(table.array(col1) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
        }

        if (arr1.length < 2) return {};
        
        let t = 0;
        let p = 1;
        let df = 0;
        
        if (testType === '1-Sample') {
            t = jStat.tscore(popMean, arr1);
            p = jStat.ttest(t, arr1.length, 2);
            df = arr1.length - 1;
        } else if (testType === 'Independent') {
            if (!groupNames) {
                if (!col2 || !table.columnNames().includes(col2)) return {};
                arr2 = Array.from(table.array(col2) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
            }
            if (arr2.length < 2) return {};
            
            t = ss.tTestTwoSample(arr1, arr2) || 0;
            p = jStat.ttest(t, arr1.length + arr2.length, 2);
            df = arr1.length + arr2.length - 2;
        } else if (testType === 'Paired') {
            if (!col2 || !table.columnNames().includes(col2)) return {};
            const arr2Raw = Array.from(table.array(col2) as Iterable<number>);
            const raw1 = Array.from(table.array(col1) as Iterable<number>);
            
            const diffs = [];
            for (let i = 0; i < raw1.length; i++) {
                if (typeof raw1[i] === 'number' && !isNaN(raw1[i]) && typeof arr2Raw[i] === 'number' && !isNaN(arr2Raw[i])) {
                    diffs.push(raw1[i] - arr2Raw[i]);
                }
            }
            if (diffs.length < 2) return {};
            t = jStat.tscore(0, diffs);
            p = jStat.ttest(t, diffs.length, 2);
            df = diffs.length - 1;
        }
        
        const summaryData: Record<string, any> = {
            Test: testType,
            'T-Stat': t,
            'P-Value': p,
            DOF: df
        };
        if (groupNames) {
            summaryData['Group 1'] = `${groupNames[0]} (n=${arr1.length})`;
            summaryData['Group 2'] = `${groupNames[1]} (n=${arr2.length})`;
        }
        const summary = aq.from([summaryData]);
        
        return { Summary: summary, 'T-Stat': t, 'P-Value': p };
    }
}
