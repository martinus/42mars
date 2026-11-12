;redcode-icws
;name Gisela 6279
;author Andrzej Maciejczak
;strategy B-scanner
;assert CORESIZE==8192

krok 	equ 652
krok2	equ 2*krok

da1	dat <2731,	<-adr3
loop2	add #krok+10,	adr	
sp2	spl 0				;
mob	mov @adr3,	<adr
	mov @adr3,	<adr
koniec	djn mob,	<da1-1
jm1	jmp -1,		#0		;zero
sp1	spl 0,		da1-adr3
loop	add #krok2+1,	adr
pocz	mov jm1,	@adr
	mov sp3,	<adr		;
adr	jmz loop,	@krok2+jm1		
adr3	jmp loop2,	sp1
sp3	spl 0,		krok+1
	end pocz			;

