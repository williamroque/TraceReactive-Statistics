import { BaseNode } from '@tracereactive/types';
import { TransformsCategory } from '../../categories';
import * as aq from 'arquero';
import * as ss from 'simple-statistics';

export class NormalizeNode extends BaseNode {
    readonly category = TransformsCategory;
    readonly typeId = 'stats:normalize';
    readonly displayName = 'Normalize / Scale';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Data', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'columns', label: 'Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'method', label: 'Method', type: 'select' as const, options: [{ label: 'Z-Score', value: 'Z-Score' }, { label: 'Min-Max', value: 'Min-Max' }, { label: 'Robust', value: 'Robust' }], defaultValue: 'Z-Score' }
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
        
        const method = properties['method'] as string;
        
        const derivations: Record<string, any> = {};
        
        for (const col of cols) {
            const arr = Array.from(table.array(col) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
            if (arr.length === 0) continue;
            
            if (method === 'Z-Score') {
                const m = ss.mean(arr);
                const s = ss.sampleStandardDeviation(arr);
                derivations[col] = aq.escape((d: any) => s === 0 ? 0 : (d[col] - m) / s);
            } 
            else if (method === 'Min-Max') {
                const mn = ss.min(arr);
                const mx = ss.max(arr);
                const rng = mx - mn;
                derivations[col] = aq.escape((d: any) => rng === 0 ? 0 : (d[col] - mn) / rng);
            }
            else if (method === 'Robust') {
                const median = ss.median(arr);
                const q25 = ss.quantile(arr, 0.25);
                const q75 = ss.quantile(arr, 0.75);
                const iqr = q75 - q25;
                derivations[col] = aq.escape((d: any) => iqr === 0 ? 0 : (d[col] - median) / iqr);
            }
        }
        
        return { Data: table.derive(derivations) };
    }
}
