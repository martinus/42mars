;redcode-94nop
;name CLP-shot 3
;author G.Labarga
;assert CORESIZE==8000
;strategy 0.8c Scan -> spl/spl/dat CLP!
;strategy Thanks to p.Kline for his little tweak

	smod EQU 7
	sstep EQU (smod*667)
	d1 EQU (2*sstep)+smod
	d2 EQU (2*sstep)
	decoy equ gate-400

dist  equ   5534
fc1 equ (gate-32)
fc2 equ (last+32)

loop:	sub.f inc,@2
start:	sne.i *gate,@gate
	sub.f inc,gate
scan:	sne.i *gate,@gate
	djn.b loop,<decoy
	djn.f setf,@-3
	dat 0,0
inc:	dat >(-2*sstep),>(-2*sstep)
for 63
	dat 0,0
rof
gate:	dat copy+1+d1,copy+1+d2
for 2
	dat 0,0
rof
sw:	dat <1,(fc2+2)
sbm:	spl #(fc2+2),(fc2+2)
for 8
	dat 0,0
rof
ptr:	dat 0,dist
setf:	mov *check,@check
clop:	mov *sw,>gate		;0.5c clear
	mov *sw,>gate
check:	sne.b fc1,fc2
	djn.f clop,}sbm		;jumps when switches
copy:	mov }ptr,@ptr
	jmn.f copy,>ptr	
	mov gate,gate+dist
	sub.ab #dist,@-1
	mov sw,sw+dist
	mov sbm,sbm+dist
last:	jmp ptr+dist+1

end start
