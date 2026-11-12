;redcode-icws
;name Gisela 6927
;author Andrzej Maciejczak
;strategy B-scanner
;assert CORESIZE==8192

krok 	equ 652

da1	dat <2731,	#-adr3
sp1	spl 0,		da1-adr3
loop	add #krok,	@jml
adr	jmz -1,		krok+adr	;b8a51
	add #1,		@adr
jml	jmz loop,	@adr
loop2	mov adr,	adr2	
	spl 0				;
mob	mov @adr3,	<adr2
	djn mob,	<da1-1
	dat #0,		#0		
adr2	dat #0,		#0		;
adr3	dat #0,		#sp1
	end adr

