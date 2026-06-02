import React, { useCallback, useMemo, useState } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import type { ColumnType, ColumnsType } from 'antd/es/table';
import './ResizableTable.css';

const MIN_COLUMN_WIDTH = 48;

export type ResizableColumn<T> = ColumnType<T> & { width: number };

type HeaderCellProps = React.HTMLAttributes<HTMLTableCellElement> & {
  width?: number;
  onResize?: (nextWidth: number) => void;
};

const ResizableHeaderCell: React.FC<HeaderCellProps> = (props) => {
  const { onResize, width, style, children, className, ...rest } = props;

  if (!width || !onResize) {
    return (
      <th {...rest} className={className} style={style}>
        {children}
      </th>
    );
  }

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      onResize(Math.max(MIN_COLUMN_WIDTH, Math.round(startWidth + moveEvent.clientX - startX)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <th
      {...rest}
      className={[className, 'km-resizable-th'].filter(Boolean).join(' ')}
      style={{ ...style, width, minWidth: width, maxWidth: width, position: 'relative' }}
    >
      {children}
      <span
        className="km-resizable-handle"
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
        onMouseDown={onHandleMouseDown}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
};

function columnKey<T>(col: ColumnType<T>, index: number): string {
  if (col.key != null) return String(col.key);
  if (col.dataIndex != null) return String(col.dataIndex);
  return `col-${index}`;
}

function useResizableColumns<T>(initialColumns: ResizableColumn<T>[]): [ColumnsType<T>, number] {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    initialColumns.forEach((col, i) => {
      map[columnKey(col, i)] = col.width;
    });
    return map;
  });

  const handleResize = useCallback(
    (key: string) => (nextWidth: number) => {
      setWidths((prev) => ({ ...prev, [key]: Math.max(MIN_COLUMN_WIDTH, nextWidth) }));
    },
    [],
  );

  const columns: ColumnsType<T> = useMemo(
    () =>
      initialColumns.map((col, index) => {
        const key = columnKey(col, index);
        const width = widths[key] ?? col.width;
        return {
          ...col,
          width,
          ellipsis: col.ellipsis ?? true,
          onHeaderCell: () => ({
            width,
            onResize: handleResize(key),
          }),
        };
      }),
    [initialColumns, widths, handleResize],
  );

  const scrollX = useMemo(
    () => initialColumns.reduce((sum, col, index) => sum + (widths[columnKey(col, index)] ?? col.width), 0),
    [initialColumns, widths],
  );

  return [columns, scrollX];
}

/** Table with draggable column widths — drag the vertical bar on the right of each header cell. */
export function ResizableTable<T extends object>({
  columns: initialColumns,
  scroll,
  className,
  ...rest
}: Omit<TableProps<T>, 'columns'> & { columns: ResizableColumn<T>[] }) {
  const [columns, scrollX] = useResizableColumns(initialColumns);

  return (
    <Table<T>
      {...rest}
      className={['km-resizable-table', className].filter(Boolean).join(' ')}
      columns={columns}
      tableLayout="fixed"
      scroll={{ ...scroll, x: scroll?.x ?? Math.max(scrollX, 1) }}
      components={{
        header: {
          cell: ResizableHeaderCell,
        },
      }}
    />
  );
}
