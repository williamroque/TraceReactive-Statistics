import { BaseNode } from '@tracereactive/types';
import { DescriptiveCategory } from '../../categories';
import * as aq from 'arquero';
import * as ss from 'simple-statistics';

export class QuantilesNode extends BaseNode {
    readonly category = DescriptiveCategory;
    readonly typeId = 'stats:quantiles';
    readonly displayName = 'Quantiles';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Result', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'columns', label: 'Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'q', label: 'q (0 to 1)', type: 'number' as const, defaultValue: 0.5, min: 0, max: 1 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        let cols = (properties['columns'] as string || '').split(',').map(c => c.trim()).filter(Boolean);
        if (cols.length === 0) {
            cols = table.columnNames().filter(c => typeof table.get(c, 0) === 'number');
        }
        
        let q = Number(properties['q']);
        if (isNaN(q)) q = 0.5;

        const summaryRows: any[] = [];
        
        for (const col of cols) {
            const arr = Array.from(table.array(col) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
            if (arr.length === 0) continue;
            
            const row: any = {
                column: col,
                quantile: q,
                value: ss.quantile(arr, q)
            };
            summaryRows.push(row);
        }

        return { Result: aq.from(summaryRows) };
    }
}
