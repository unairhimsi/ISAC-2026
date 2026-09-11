<?php

namespace App\Policies;

use App\Models\Admin;
use App\Models\Submission;

class SubmissionPolicy
{
    public function before(Admin $admin, string $ability): ?bool
    {
        return $admin->role === 'super_admin' ? true : null;
    }

    public function viewAny(Admin $admin): bool
    {
        return in_array($admin->role, ['judge', 'admin_registration'], true);
    }

    public function view(Admin $admin, Submission $submission): bool
    {
        return $this->viewAny($admin);
    }

    public function review(Admin $admin, Submission $submission): bool
    {
        return in_array($admin->role, ['judge'], true);
    }
}
