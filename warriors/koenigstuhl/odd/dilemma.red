;redcode-tinyLP
;name Dilemma
;author G.Labarga
;assert 1
;       CORESIZE==800 && MAXPROCESSES==8 && PSPACESIZE>0
;strategy P^3: imp/gate or scanner
;strategy p^3 or not p^3...

	sstep equ 206	;(2*1703)
	sloc equ ptr+400
	gate equ train-30
	where equ 202
	STRAT1 equ bci
	STRAT2 equ bsca
	D_STATE equ 35

train:	mov.i bm,<gate
	djn.f -1,<gate
	jmp #0,<gate
for 5
	dat 0,0
rof
ptr:	jmp #sstep,atk+sstep
loop:	add.ab {0,}0
scan:	jmz.f loop,@ptr
atk:	mov @0,@ptr		;<-hit
	jmz.a loop,atk
clr:	spl #0,<0
ssrc:	mov dbm,<-9
	dat 0,0
dbm:	dat <-9,<start
for 9
	dat 0,0
rof
bsca:	mov *ssrc,sloc+8
	mov *bsca,<sgo
for 6
	mov {bsca,<sgo
rof
	spl scan,{0
sgo:	jmp sloc+2,sloc+7

start:	LDP.A #0,*bm		;9
	LDP.BA 2,@bm		;8
	MOD.BA *start,@bm	;7
	STP.B *STATE,#D_STATE
STATE:	JMP }0,64		;state0
TABLE:	jmp STRAT1,200		;state1
	dat STRAT2,66		;state2
	dat STRAT2,378		;state3
	dat STRAT1,128		;state4

bm:	dat <start,{STATE
bci:
aimp:	mov.i #1,*1
	spl where,<where
pREF:	spl train,{0
bimp:	mov.i #1,1

end start

;RESULT:	DAT 0,8	not needed :)
;	DAT 0,7
;	DAT 0,9



