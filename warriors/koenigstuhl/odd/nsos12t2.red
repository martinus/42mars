;redcode-94
;name NSos12Tiny.2
;assert 1
;       CORESIZE==800
;author Nenad Tomasev
;strategy oneshot

step equ 7
ini equ 87
dstep equ -196

 org scan
gate dat 0, 8
 dat <267, 8
jb jmp #dstep, 9
clear spl #2*step, >2*step
 mov jb, >gate
 mov jb, >gate
 djn.a -2, {jb
 jmp clear+1, 0
 for 4
 dat 0, 0
 rof
incr add.f clear, scan
scan sne }ini, >ini+step
 djn.f incr, <dstep
 mov.ab scan, gate
 mov.a #720, clear
 jmp clear, 0
 for MAXLENGTH-CURLINE
 dat 0, 0
 rof
 end
