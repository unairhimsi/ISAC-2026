<?php

namespace App\Policies;

use App\Models\Admin;

class ExamPolicy
{
    public function author(Admin $admin): bool
    {
        return in_array($admin->role, ['super_admin', 'judge'], true);
    }
}
