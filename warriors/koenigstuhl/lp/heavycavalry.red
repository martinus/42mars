;redcode-lp
;name Heavy cavalry
; (no handshake)
;author G.Labarga
;assert CORESIZE==8000 && MAXPROCESSES==8
;strategy P-warrior
;strategy Slavery removed
;Rottinger II or clp-shot 3
; no pin

;----- P^3 constants:
	D_STATE equ 175
	STRAT1 equ loop+1	;stone/paper
	STRAT2 equ lchp		;oneshot-clp
;--- stone
	step equ 4954

;----- CLP-shot 3
smod EQU 7
sstep EQU (smod*667)
d1 EQU (2*sstep)+smod
d2 EQU (2*sstep)
decoy equ gate-400
dist  equ   5534
fc1 equ (gate-32)
fc2 equ (last+32)

;----- s/p constants:
pdist equ 4215
pinit equ 5172
bstep1 equ 1171
bstep2 equ 826
decrem equ 2903
pdist2 equ 468
pinit2 equ 5843
decrem2 equ 5436

src:	mov.ab #9,#9
v1:	add.a #pdist,dst
loop1:	mov.i <src,{dst
	mov.i {bstep1,{bstep2
	add.f {0,}0
	jmn.b loop1,src
	spl @src,>decrem
dst:	jmz.b pinit,*0
bm:	dat }1,>1
for 23
	dat 0,0
rof
start:
pbrain:	LDP.A #0,RES
pswitch:LDP.BA 2,STATE
	MOD.BA *RES,STATE
	STP.B *STATE,#D_STATE
STATE:	JMP }0,36		        ;state0
TABLE:	jmp STRAT1,72		;state1
	dat STRAT1,108		        ;state2
	dat STRAT1,24		        ;199 (4 1 3) ó 24 (4 0 3) ;state3
	dat STRAT2,214		        ;state4
RES:	dat 0,5
lchp:	spl *loop1+3,6
	jmp loop2,7
for 31
	dat 0,0
rof
loop:	sub.f inc,@2
	sne.i *gate,@gate
	sub.f inc,gate
scan:	sne.i *gate,@gate
	djn.b loop,<decoy
	djn.f setf,@-3
	dat 0,0
inc:	dat >(-2*sstep),>(-2*sstep)
for 36
	dat 0,0
rof
src2:	mov.ab #9,#9
v2:	add.a #pdist2,dst2
loop2:	mov.i <src2,{dst2
	mov.i {bstep1,{bstep2
	add.f {0,}0
	jmn.b loop2,src2
	spl @src2,}decrem2
dst2:	jmz.b pinit2,*0
	dat }1,>1
for 32
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

