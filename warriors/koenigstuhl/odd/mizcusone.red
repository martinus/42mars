;assert 1
;name Mizcus one
;author Miz
;assert 1

step equ 26
gap equ 10
j jmp #step, #step
sub.f j, 1
start sne.i -200, -200-gap
djn.f -2, <7900
mov.i j, {-2
mov.i j, {-3
djn.b -2, #900
spl #step
mov.i 2, >-11
djn.f -1, >-12
dat <2667, >15

org start
