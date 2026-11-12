;redcode-icws
;name Gisela 7131
;author Andrzej Maciejczak
;strategy like P.Kline's Cannonade
;assert CORESIZE==8192

krok	equ 1432
ile	equ 1
step	equ 2731
dod	equ 0
c1	equ 303
rozm	equ 300	

	for MAXLENGTH-21-ile
	dat <-start,<-pocz
	rof
start
licz	for ile
	mov <imp+c1+4+licz*krok,<imp+c1-licz*krok
	rof
	jmp pocz
ad3	add adr+3,adr
st1	spl -1,<-c1-rozm+dod
adr	mov <4+(ile+1)*krok,<-(ile+1)*krok		;0
        djn -2,<st1-c1-rozm+dod				;1
step1   mov krok,<-krok					;4
pocz	mov step1,imp+3+c1
ad1	mov adr+1,imp+1+c1
	mov adr,imp+c1
	spl @1
	mov adr-1,imp-1+c1
	mov adr-2,imp-2+c1
	spl 1
	spl 1
	spl 1
	mov -1,0
	spl 2
	jmp imp
	add st2,-1
st2	dat #step,#0
imp	mov 0,step
	end start

