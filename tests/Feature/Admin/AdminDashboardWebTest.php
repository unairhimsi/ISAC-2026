<?php

use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

test('admin dashboard routes render their expected inertia pages', function (): void {
    $routes = [
        '/admin/dashboard' => 'Admin/Dashboard',
        '/admin/teams' => 'Admin/Teams/Index',
        '/admin/payments' => 'Admin/Payments',
        '/admin/competitions' => 'Admin/Competitions',
        '/admin/batches' => 'Admin/Batches',
        '/admin/stages' => 'Admin/Stages',
        '/admin/questions' => 'Admin/Questions',
        '/admin/judging' => 'Admin/Judging',
    ];

    foreach ($routes as $route => $component) {
        $this->get($route)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component($component, false));
    }
});

test('admin team detail route forwards the team id to the page', function (): void {
    $teamId = (string) Str::uuid();

    $this->get("/admin/teams/{$teamId}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Teams/Show', false)
            ->where('teamId', $teamId));
});

test('admin judging attempt detail route forwards exam and attempt ids to the page', function (): void {
    $examId = (string) Str::uuid();
    $attemptId = (string) Str::uuid();

    $this->get("/admin/judging/{$examId}/attempts/{$attemptId}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Judging/Show', false)
            ->where('examId', $examId)
            ->where('attemptId', $attemptId));

    $this->get("/admin/judging/not-a-uuid/attempts/{$attemptId}")->assertNotFound();
});
