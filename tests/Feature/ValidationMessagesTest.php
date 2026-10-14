<?php

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Validator;

test('the Indonesian validation file defines every framework validation key', function (): void {
    $english = require base_path('vendor/laravel/framework/src/Illuminate/Translation/lang/en/validation.php');
    $indonesian = require lang_path('id/validation.php');

    $ruleKeys = fn (array $lines): array => array_values(array_filter(
        array_keys(Arr::dot($lines)),
        fn (string $key): bool => ! str_starts_with($key, 'custom') && ! str_starts_with($key, 'attributes'),
    ));

    expect(array_values(array_diff($ruleKeys($english), $ruleKeys($indonesian))))->toBe([]);
});

test('validation errors are returned in Indonesian instead of raw language keys', function (): void {
    app()->setLocale('id');

    $errors = Validator::make(
        ['title' => 'ab', 'file_id' => 'bukan-uuid', 'members' => []],
        ['title' => ['required', 'min:3'], 'file_id' => ['uuid'], 'members' => ['required', 'array', 'min:1'], 'email' => ['required']],
    )->errors();

    expect($errors->first('title'))->toBe('Kolom judul minimal 3 karakter.')
        ->and($errors->first('file_id'))->toBe('Kolom file harus berupa UUID yang valid.')
        ->and($errors->first('members'))->toBe('Kolom peserta wajib diisi.')
        ->and($errors->first('email'))->toBe('Kolom email wajib diisi.')
        ->and(implode(' ', Arr::flatten($errors->toArray())))->not->toContain('validation.');
});
