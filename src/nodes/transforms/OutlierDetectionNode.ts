import { BaseNode } from '@tracereactive/types';
import { TransformsCategory } from '../../categories';
import * as aq from 'arquero';
import * as ss from 'simple-statistics';

export class OutlierDetectionNode extends BaseNode {
    readonly category = TransformsCategory;
    readonly typeId = 'stats:outliers';
    readonly displayName = 'Outlier Detection';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Data', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'columns', label: 'Columns (csv)', type: 'text' as const, defaultValue: '' },
        { name: 'method', label: 'Method', type: 'select' as const, options: [{ label: 'Z-Score', value: 'Z-Score' }, { label: 'IQR', value: 'IQR' }], defaultValue: 'Z-Score' },
        { name: 'threshold', label: 'Threshold', type: 'number' as const, defaultValue: 3 },
        { name: 'action', label: 'Action', type: 'select' as const, options: [{ label: 'flag', value: 'flag' }, { label: 'filter', value: 'filter' }, { label: 'clip', value: 'clip' }], defaultValue: 'flag' }
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
        const action = properties['action'] as string;
        let thresh = Number(properties['threshold']);
        if (isNaN(thresh)) thresh = 3;
        
        const bounds: Record<string, {lower: number, upper: number}> = {};
        
        for (const col of cols) {
            const arr = Array.from(table.array(col) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
            if (arr.length === 0) continue;
            
            if (method === 'Z-Score') {
                const m = ss.mean(arr);
                const s = ss.sampleStandardDeviation(arr);
                bounds[col] = { lower: m - (thresh * s), upper: m + (thresh * s) };
            } 
            else if (method === 'IQR') {
                const q25 = ss.quantile(arr, 0.25);
                const q75 = ss.quantile(arr, 0.75);
                const iqr = q75 - q25;
                bounds[col] = { lower: q25 - (thresh * iqr), upper: q75 + (thresh * iqr) };
            }
        }
        
        if (action === 'flag') {
            const flagCol = 'is_outlier';
            return {
                Data: table.derive({
                    [flagCol]: aq.escape((d: any) => {
                        for (const c of cols) {
                            if (d[c] !== undefined && bounds[c]) {
                                if (d[c] < bounds[c].lower || d[c] > bounds[c].upper) return true;
                            }
                        }
                        return false;
                    })
                })
            };
        } 
        else if (action === 'filter') {
            return {
                Data: table.filter(aq.escape((d: any) => {
                    for (const c of cols) {
                        if (d[c] !== undefined && bounds[c]) {
                            if (d[c] < bounds[c].lower || d[c] > bounds[c].upper) return false;
                        }
                    }
                    return true;
                }))
            };
        }
        else if (action === 'clip') {
            const derivations: Record<string, any> = {};
            for (const col of cols) {
                if (bounds[col]) {
                    derivations[col] = aq.escape((d: any) => {
                        if (d[col] === undefined || d[col] === null) return d[col];
                        if (d[col] < bounds[col].lower) return bounds[col].lower;
                        if (d[col] > bounds[col].upper) return bounds[col].upper;
                        return d[col];
                    });
                }
            }
            return { Data: table.derive(derivations) };
        }
        
        return { Data: table };
    }
}
