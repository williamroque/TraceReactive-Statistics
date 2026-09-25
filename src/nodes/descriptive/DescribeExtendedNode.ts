import { BaseNode } from '@tracereactive/types';
import { DescriptiveCategory } from '../../categories';
import * as aq from 'arquero';
import * as ss from 'simple-statistics';

export class DescribeExtendedNode extends BaseNode {
    readonly category = DescriptiveCategory;
    readonly typeId = 'stats:describe';
    readonly displayName = 'Describe (Extended)';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Summary', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'columns', label: 'Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'percentiles', label: 'Percentiles (csv)', type: 'text' as const, defaultValue: '25,50,75' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        let cols = (properties['columns'] as string || '').split(',').map(c => c.trim()).filter(Boolean);
        if (cols.length === 0) {
            // Default to numeric columns
            cols = table.columnNames().filter(c => typeof table.get(c, 0) === 'number');
        }
        
        if (cols.length === 0) return { Summary: aq.table({}) };

        const pStrs = (properties['percentiles'] as string || '25,50,75').split(',').map(p => p.trim()).filter(Boolean);
        const pVals = pStrs.map(p => Number(p) / 100).filter(p => !isNaN(p) && p >= 0 && p <= 1);

        const summaryRows: any[] = [];
        
        for (const col of cols) {
            const arr = Array.from(table.array(col) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
            if (arr.length === 0) continue;
            
            const row: any = {
                column: col,
                count: arr.length,
                mean: ss.mean(arr),
                std: arr.length > 1 ? ss.standardDeviation(arr) : 0,
                var: arr.length > 1 ? ss.variance(arr) : 0,
                min: ss.min(arr),
                max: ss.max(arr)
            };
            
            for (let i = 0; i < pVals.length; i++) {
                row[`p${pStrs[i]}`] = ss.quantile(arr, pVals[i]);
            }
            
            summaryRows.push(row);
        }
        
        if (summaryRows.length === 0) return { Summary: aq.table({}) };

        return { Summary: aq.from(summaryRows) };
    }
}
