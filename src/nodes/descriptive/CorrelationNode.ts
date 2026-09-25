import { BaseNode } from '@tracereactive/types';
import { DescriptiveCategory } from '../../categories';
import * as aq from 'arquero';
import * as ss from 'simple-statistics';
import { jStat } from 'jstat';

export class CorrelationNode extends BaseNode {
    readonly category = DescriptiveCategory;
    readonly typeId = 'stats:correlation';
    readonly displayName = 'Correlation Matrix';
    readonly visible = true;
    
    readonly inputs = [
        { name: 'Data', acceptsType: 'core:dataframe' }
    ];
    
    readonly outputs = [
        { name: 'Matrix', outputType: 'core:dataframe' },
        { name: 'Tidy', outputType: 'core:dataframe' }
    ];
    
    readonly properties = [
        { name: 'method', label: 'Method', type: 'select' as const, options: [{ label: 'Pearson', value: 'Pearson' }, { label: 'Spearman', value: 'Spearman' }], defaultValue: 'Pearson' },
        { name: 'columns', label: 'Columns (csv)', type: 'text' as const, defaultValue: '' }
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
        if (cols.length < 2) return { Matrix: aq.table({}), Tidy: aq.table({}) };

        const isSpearman = properties['method'] === 'Spearman';
        
        const colData: Record<string, number[]> = {};
        for (const c of cols) {
            colData[c] = Array.from(table.array(c) as Iterable<number>);
        }
        
        const numRows = table.numRows();
        
        const matrixRows: any[] = [];
        const tidyRows: any[] = [];
        
        for (let i = 0; i < cols.length; i++) {
            const rowInfo: any = { Variable: cols[i] };
            for (let j = 0; j < cols.length; j++) {
                const c1 = cols[i];
                const c2 = cols[j];
                
                const pairs = [];
                for (let r = 0; r < numRows; r++) {
                    const v1 = colData[c1][r];
                    const v2 = colData[c2][r];
                    if (typeof v1 === 'number' && typeof v2 === 'number' && !isNaN(v1) && !isNaN(v2)) {
                        pairs.push([v1, v2]);
                    }
                }
                
                let corr = 1;
                if (i !== j && pairs.length > 1) {
                    const arr1 = pairs.map(p => p[0]);
                    const arr2 = pairs.map(p => p[1]);
                    
                    if (isSpearman) {
                        try {
                           corr = jStat.spearmancoeff(arr1, arr2);
                        } catch (e) {
                           corr = ss.sampleCorrelation(arr1, arr2);
                        }
                    } else {
                        corr = ss.sampleCorrelation(arr1, arr2);
                    }
                    if (isNaN(corr)) corr = 0;
                }
                
                rowInfo[c2] = corr;
                tidyRows.push({ var1: c1, var2: c2, r: corr });
            }
            matrixRows.push(rowInfo);
        }
        
        return { 
            Matrix: aq.from(matrixRows),
            Tidy: aq.from(tidyRows)
        };
    }
}
