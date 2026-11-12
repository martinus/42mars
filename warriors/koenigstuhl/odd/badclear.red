;redcode
;assert 1
;author Miz
;name Bad clear
spl #6, #6
sub.f #1, -2
sub.f 3, -2
mov.i 3, *-3
mov.i 2, *-4
djn.b -3, -4
