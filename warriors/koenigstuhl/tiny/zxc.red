;redcode-tiny
;name zxc
;author G.Labarga
;assert CORESIZE==800
;strategy Anti-clear bomber-> d-clear
;strategy Like Muskrat, with smaller decoy and anti A-imp clear

step equ 705	;(2861 *5)
d1 equ hit+(1*step)
d2 equ hit+(2*step)
gate equ (loop-3)
cnt equ 53
decoy equ bmb-308

bmb:	mov step,1
loop:	mov bmb,@ref
	mov bmb,*ref
ref:	mov d1,*d2
	sub.f inc,ref
hit:	djn.b loop,#cnt
inc:	spl #(-3*step),<(-3*step)
	mov cbm,}gate
	djn.f -1,}gate
cbm:	dat (1-gate),{267
for 6
	dat 0,0
rof
start:	djn.f 1,<decoy
	mov {decoy+1,<decoy-3
	mov {decoy+2,<decoy-5
	djn.a loop,<decoy-7

end start

