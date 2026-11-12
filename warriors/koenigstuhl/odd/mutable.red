;redcode-94
;name Mutable
;author G.Labarga
;assert CORESIZE==8000 && PSPACESIZE>0
;strategy Addaptative p^3
; It is a p^3 switcher, but changes states' strategies depending results
;ver 2

pin 211
;pspace locations
; -strats: 4-15
	strat1 equ clear
	strat2 equ gate
	strat3 equ imp
	d_state equ 499
	d_statbef equ 2
	p_leader equ 111	;leader flag location
	c_leader equ 99		;leader flag value

start:	nop 0,0			;wait leader to set flag
ldflg:	ldp.a #p_leader,#c_leader
	sne.ab ldflg,ldflg	;check "leader" flag
	dat 0,0			;suicide
	ldp.b statbef,statbef	;Only 12 cycles
	jmz.b init,@statbef	;Partial brainwash detect/1st round
	ldp.ba state-1,state
	ldp.a #0,result
	ldp.ba statbef,strbef
resbef:	add.a result,strbef
statbef:stp.ab *strbef,#d_statbef
slct:	mod.ba *result,state
	stp.ab state,#d_statbef
	stp.b *state,#d_state
state:	ldp.a #0,1
result:	jmp }0    ,10	;loss
	dat strat1,11	;win
	dat strat2,13	;tie
	dat strat3,785	;state  4
strbef:	dat 1 	  ,1006	;state  5
	dat 3 	  ,787	;state  6
	dat 1 	  ,358	;state  7
	dat 2 	  ,789	;state  8
	dat 3 	  ,1174	;state  9
	dat 1,0
	dat 0,0
	dat 0,0
	dat 0,0
init:	stp.b ictr,<decoy	;initialize strat table
	stp.b ictr,<decoy
	stp.b ictr,<decoy
ictr:	djn.b init,#3
	mov.a #5,state
	jmp slct,}result
decoy:	dat 0,10
i for 9				;initialization data
	dat 0,3+i
rof
;-------------------------------[ strategies ]----------------------
for 10
	dat 0,0
rof
	ptr equ clear-3

clear:	mov bmb,}ptr
	mov bmb,}ptr
	jmp -2
bmb:	dat 7,0
for 5
	dat 0,0
rof
gate:	jmp #0,<-3

imp:	mov.i #4,1

	end start
