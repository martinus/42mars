;redcode-tiny
;name WriteLn('Victory');
;author Nenad Tomasev
;assert CORESIZE==800
;strategy oneshot

span equ 7
step equ 17
ini equ 34
ds equ -248

 org scan
gate dat 0, ((scan-gate)-2)
b dat 1, 12
clear spl #step, step
 mov.i *b, >gate
 mov.i *b, >gate
 djn.f -2, }clear
 for 6
 dat 0, 0
 rof
inc add.f clear, scan
scan sne ini, >ini+span
 djn.f inc, <ds
 add.ab scan, gate
 jmp clear, >-70
 for MAXLENGTH-CURLINE
 dat 0, 0
 rof
 end

