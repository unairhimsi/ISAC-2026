<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        @page { margin: 12mm 10mm 14mm 10mm; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 7.5pt; color: #1f2937; }
        h1 { font-size: 13pt; margin: 0 0 3px 0; color: #111827; }
        .meta { margin: 0 0 8px 0; font-size: 7.5pt; color: #6b7280; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { display: table-header-group; }
        th { background: #1f2937; color: #ffffff; font-size: 7pt; text-align: left; padding: 4px 5px; border: 1px solid #374151; }
        td { border: 1px solid #d1d5db; padding: 3px 5px; vertical-align: top; word-wrap: break-word; }
        td.alt { background: #f3f4f6; }
        .empty { padding: 14px; text-align: center; color: #6b7280; border: 1px solid #d1d5db; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <p class="meta">
        Dibuat {{ $generatedAt }} ({{ $timezone }}) &middot; {{ number_format(count($rows), 0, ',', '.') }} baris
        @foreach ($summary as [$name, $text])
            <br>{{ $name }}: {{ $text }}
        @endforeach
    </p>

    @if (count($rows) === 0)
        <p class="empty">Tidak ada data yang sesuai dengan filter.</p>
    @else
        <table>
            <colgroup>
                @foreach ($columns as $column)
                    <col style="width: {{ round($column->width / $totalWidth * 100, 2) }}%">
                @endforeach
            </colgroup>
            <thead>
                <tr>
                    @foreach ($columns as $column)
                        <th>{{ $column->label }}</th>
                    @endforeach
                </tr>
            </thead>
            <tbody>
                @foreach ($rows as $row)
                    <tr>
                        @foreach ($row as $cell)
                            <td{!! $loop->parent->odd ? '' : ' class="alt"' !!}>{{ $cell }}</td>
                        @endforeach
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif
</body>
</html>
