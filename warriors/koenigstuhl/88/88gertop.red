;redcode
;name 88GerTop
;Found it was unnamed already... :)
;author G.Labarga
;assert CORESIZE==8000
;strategy Qscan->stone/imp
;stone from hurricaner2

;optimax 1234
;optimax work 88ger
;optimax suite fsh88
;optimax rounds 1 150 150 300
;optimax phase1 cyclemin 100%
;optimax phase2 fsh88\scn\scanthecan.red
;optimax phase2 90%
;optimax phase3 top20
;optimax phase3 sbi
;optimax phase3 90%
;optimax phase4 100%
;optimax phase4 95%
;optimax phase4 top20

;----- stone
step equ (4279*4)	;( 1062 *4)
d2 equ 1-(1*step)+4
trail equ 6735
stloc equ (boot+ 1100 );6220)

;----- imp pump
istep equ 1143		;7-pt imps
iploc equ (stloc+4+1+(1623*8))

boot:	mov bmb,stloc+6
sdst:	mov <ssrc,stloc
	mov imp,(iploc+istep-1)
	spl 1
ssrc:	spl 1,stone+5
	mov <ssrc,<sdst
	mov <psrc,<pdst
	djn @sdst,#4
pdst:	jmp @0,iploc

stone:	spl 0,<1-step		;after the bombing phase
ref:	mov bmb+5,<d2		;turns into partial gated clear
	mov bmb+5,@ref		;and ends as a perfect gate
	sub #(2*step),-2 ;@-1
	djn ref,<trail	;@-2,<trail
bmb:	dat <-step,<-step

psrc:
pump:	spl 0,4
	add 1,2
	mov (istep+1),@1	;Imp is located istep+1 away
	jmp (istep)-2*(istep+1),<(istep-1)
imp:	mov 0,istep


qs   equ 322 
qd   equ 161 

qscan cmp 2*qs+qd      , 2*qs 
qt1  jmp qa0           , <3*qs 
     cmp qscan+5*qs+qd , qscan+5*qs 
qt2  jmp qa1           , <4*qs 
     cmp qscan+4*qs+qd , qscan+4*qs 
qs1  djn qa1           , #qt1 
     cmp qscan+10*qs-2 , qscan+10*qs+qd-2
qs2  djn qa2           , #qt2 
     cmp qscan+9*qs+qd , qscan+9*qs 
qt3  jmp qa2           , <6*qs 
     cmp qscan+6*qs+qd , qscan+6*qs 
     jmp qa2           , <qa1 
     cmp qscan+8*qs+qd , qscan+8*qs 
     jmp qa2           , <qs1 
     cmp qscan+11*qs   , qscan+11*qs+qd 
     jmp qa3           , <qa2 
     cmp qscan+18*qs-8 , qscan+18*qs+qd-8
qs3  djn qa3           , #qt3 
     cmp qscan+16*qs-2 , qscan+16*qs+qd-2 
     jmp qa3           , <qs2 
     cmp qscan+12*qs   , qscan+12*qs+qd 
     jmp qa3           , <qa1 
     cmp qscan+14*qs   , qscan+14*qs+qd 
     jmp qa3           , <qs1 
     jmz boot          , qscan+15*qs 

qa3  add @qs3          , qp 
qa2  add @qs2          , @qa3 
qa1  add @qs1          , @qa3 
qa0  cmp @qp           , <1234 
     cmp @0            , 0 
     add #qd           , qp 
ql   mov qb            , @qp 
qp   mov <2345         , <qscan+2*qs 
     add #9            , @ql 		;slight changes
     djn ql            , #6
     jmp boot          , <43 
qb:  dat <1,<-63
     end qscan
