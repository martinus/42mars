;redcode-94
;name New Eclipse
;author	G.Labarga
;assert CORESIZE==8000

;strategy	Q^3-> twin anti-imp paper

;--------- Anti B-imp paper constants ---
	DEST1 EQU 6037 *8
	DEST2 EQU 2294 *8
	DEST3 EQU 6004 *8
	AT1 EQU 7569
	AT2 EQU 7907 *8	

;--------- Anti A-imp paper constants ---
	DEST4 EQU 7286 *8
	DEST5 EQU 7033 *8
	DEST6 EQU 6409 *8
	AT3 EQU 6007
	AT4 EQU 7256
;-----
	AILOC EQU 5239
	BILOC EQU 857
;-----

LCH:	SPL 1,{900
	SPL 1,{1801
	SPL 1,{3702
	MOV <BIGO,{BIGO
	MOV <AIGO,{AIGO
BIGO:	SPL BILOC,PAP1+8
AIGO:	JMP AILOC,PAP4+8
FOR 10
	DAT 0,0
ROF
PAP1:	SPL @0,<DEST1
	MOV }PAP1,>PAP1
PAP2:	SPL @0,<DEST2
	MOV }PAP2,>PAP2
	MOV.I <-AT1,<AT1
	MOV {PAP2,{PAP3
	MOV.I #1,<1
PAP3:	JMP *DEST3,<AT2
FOR 10
	DAT 0,0
ROF

PAP4:	SPL @0,<DEST4
	MOV }PAP4,>PAP4
PAP5:	SPL @0,<DEST5
	MOV }PAP5,>PAP5
	MOV.I #1,{1
	MOV.I <-AT3,<AT3
	MOV {PAP6,{PAP6
PAP6:	JMP *DEST6,<AT4
FOR 15
	DAT 0,0
ROF
;---------- cut'n pasted Q^3 Quickscanner ------------

qf 		equ 	qKil
qs 		equ 	200
qd 		equ 	4000
qi 		equ 	7
qr 		equ 	8
;----

qBmb 		dat  	{qi*qr-10	, {1
qGo  		seq  	qd+qf+qs	, qf+qs
    		jmp  	qSki		, {qd+qf+qs+qi+2
    		sne  	qd+qf+5*qs	, qf+5*qs
    		seq  	qf+4*qs		, {qTab
		jmp  	qFas		, }qTab
		sne  	qd+qf+8*qs	, qf+8*qs
    		seq  	qf+7*qs		, {qTab-1
    		jmp  	qFas		, {qFas
		sne  	qd+qf+10*qs	, qf+10*qs
    		seq  	qf+9*qs		, {qTab+1
		jmp  	qFas		, }qFas
		seq  	qd+qf+2*qs	, qf+2*qs
		jmp	qFas		, {qTab
		seq	qd+qf+6*qs	, qf+6*qs
		djn.a	qFas		, {qFas
		seq  	qd+qf+3*qs	, qf+3*qs
      		jmp  	qFas		, {qd+qf+3*qs+qi+2
		sne  	qd+qf+14*qs	, qf+14*qs
		seq 	qf+13*qs  	, <qTab
		jmp  	qSlo		, >qTab
		sne  	qd+qf+17*qs	, qf+17*qs
		seq  	qf+16*qs	, <qTab-1
		jmp  	qSlo		, {qSlo
		seq  	qd+qf+11*qs	, qf+11*qs
		jmp  	qSlo		, <qTab
		seq  	qd+qf+15*qs	, qf+15*qs
		djn.b	 qSlo		, {qSlo
		sne  	qd+qf+12*qs	, qf+12*qs
		jmz  	LCH		, qd+qf+12*qs-qi
qSlo 		mov.ba 	qTab		, qTab
qFas	 	mul.ab 	qTab		, qKil
qSki  		sne  	qBmb-1		, @qKil
    	 	add  	#qd		, qKil
qLoo  		mov.i  	qBmb		, @qKil
qKil	  	mov.i  	qBmb		, *qs
      		sub.ab 	#qi		, qKil
      		djn    	qLoo		, #qr
      		jmp    	LCH		, <-4000
    		dat  	5408		, 7217
qTab  		dat  	4804		, 6613
dSrc  		dat  	5810		, qBmb-5

	END qGo
