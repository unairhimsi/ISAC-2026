<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class FileController extends Controller
{
    public function show(Request $request, File $file): RedirectResponse
    {
        $user = $request->user();

        if ($user instanceof Team && $file->uploaded_by !== null && $file->uploaded_by !== $user->id) {
            abort(403, 'Akses file ditolak.');
        }

        return redirect()->away($file->url);
    }
}
