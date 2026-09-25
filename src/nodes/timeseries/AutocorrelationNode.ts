import { BaseNode } from '@tracereactive/types';
import { TimeSeriesCategory } from '../../categories';
import * as aq from 'arquero';
import * as ss from 'simple-statistics';

export class AutocorrelationNode extends BaseNode {
    readonly category = TimeSeriesCategory;
    readonly typeId = 'stats:acf';
    readonly displayName = 'Autocorrelation (ACF)';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Lags', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'column', label: 'Column', type: 'text' as const, defaultValue: '' },
        { name: 'maxLags', label: 'Max Lags', type: 'number' as const, defaultValue: 20 }
    ];

    async evaluate(inputs: Record<string, any>, properties: Record<string, any>) {
        for (const k in properties) {
            if (typeof properties[k] === 'object' && properties[k] !== null && 'value' in properties[k]) {
                properties[k] = properties[k].value;
            }
        }
        const table = inputs['Data'] as aq.internal.Table;
        if (!table) return {};

        const col = properties['column'] as string;
        if (!col || !table.columnNames().includes(col)) {
            return { Lags: aq.table({}) };
        }
        
        let maxLags = Number(properties['maxLags']);
        if (isNaN(maxLags) || maxLags < 1) maxLags = 20;
        
        const arr = Array.from(table.array(col) as Iterable<number>).filter(v => typeof v === 'number' && !isNaN(v));
        if (arr.length < 2) return { Lags: aq.table({}) };
        
        maxLags = Math.min(maxLags, arr.length - 1);
        
        const rows = [];
        for (let lag = 0; lag <= maxLags; lag++) {
            if (lag === 0) {
                rows.push({ lag, acf: 1 });
                continue;
            }
            
            const arr1 = arr.slice(0, -lag);
            const arr2 = arr.slice(lag);
            let acf = 0;
            if (arr1.length > 1) {
                acf = ss.sampleCorrelation(arr1, arr2);
                if (isNaN(acf)) acf = 0;
            }
            rows.push({ lag, acf });
        }
        
        return { Lags: aq.from(rows) };
    }
}
