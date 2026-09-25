import { BaseNode } from '@tracereactive/types';
import { TimeSeriesCategory } from '../../categories';
import * as aq from 'arquero';

export class DifferencingNode extends BaseNode {
    readonly category = TimeSeriesCategory;
    readonly typeId = 'stats:differencing';
    readonly displayName = 'Differencing';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Data', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'columns', label: 'Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'periods', label: 'Periods', type: 'number' as const, defaultValue: 1 },
        { name: 'method', label: 'Method', type: 'select' as const, options: ['diff', 'pct_change'], defaultValue: 'diff' }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        let cols = (properties['columns'] as string || '').split(',').map(c => c.trim()).filter(Boolean);
        if (cols.length === 0) {
            cols = table.columnNames().filter(c => typeof table.get(c, 0) === 'number');
        }
        
        let periods = Number(properties['periods']);
        if (isNaN(periods) || periods < 1) periods = 1;
        
        const method = properties['method'] as string;
        
        const derivations: Record<string, any> = {};
        
        for (const col of cols) {
            const arr = Array.from(table.array(col) as Iterable<number>);
            const out = new Array(arr.length).fill(null);
            
            for (let i = periods; i < arr.length; i++) {
                const current = arr[i];
                const prev = arr[i - periods];
                
                if (typeof current !== 'number' || isNaN(current) || typeof prev !== 'number' || isNaN(prev)) {
                    continue;
                }
                
                if (method === 'pct_change') {
                    if (prev !== 0) out[i] = (current - prev) / prev;
                } else {
                    out[i] = current - prev;
                }
            }
            derivations[`${col}_diff`] = out;
        }
        
        let newTable = table;
        for (const [k, v] of Object.entries(derivations)) {
            newTable = newTable.assign({ [k]: v });
        }
        
        return { Data: newTable };
    }
}
