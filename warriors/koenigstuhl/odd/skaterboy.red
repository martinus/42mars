;redcode-94odd
;name Skater Boy
;author Lukasz Grabun
;strategy IRCT13 stone
;assert 1

step equ 1063

a spl #step, #-step
mov <1+step , 1-step
add a, -1
jmp -2
