;redcode-94
;name mini-hsa
;author Guenzel
;strategy just using mini-hsa because I couldn't
;strategy come up with anything better.
;assert 1
; KOFACOTO-1

sdist equ 1900
slen equ len

ptr equ (bspl-6)

top
bspl spl #1 , }1
wipe mov bspl , <ptr
pptr mov >ptr , >ptr
 jmn.f wipe , >ptr
 add #7+1 , @pptr
scan jmz.f -1 , <ptr
 slt @pptr , #bot-ptr+4
 jmp wipe , <ptr
 djn scan-1 , #13
 jmp scan-1 , {wipe
bot dat 0,0
 end scan

