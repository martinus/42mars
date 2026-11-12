;name Irct_b
;author Miz
;assert 1
step equ 1748
spl imp
spl 2
spl clear
spl 1
jmp hop

clear: spl #0
mov.i 2, >-15
djn.f -1, {-16
dat $-20, $35

dat $0, >step
hop: mov.i }-1, >-1
jmp step-1, <-555
for 4
dat $0, $0
rof

imp: mov.i i, i+4002
spl i+4001
mov.i #0, 4001
mov.i #0, 4001
