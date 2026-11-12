;name irct_a
;author Miz
;assert 1
step equ 155

imp: mov.i #85, 1
mov.i imp, @1
start: mov.i imp, *step
add.ab #step, -1
jmz.f -3, start-25
jmp clear
dat $0, $0
dat $0, $0
clear: spl #0
mov.i 2, >-12
djn.f -1, {-13
dat -10, 15
end start
