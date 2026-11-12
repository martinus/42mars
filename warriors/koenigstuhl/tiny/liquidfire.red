;redcode-tiny
;name Liquid fire
;author Neo
;assert CORESIZE==800
;strategy Klear/Himp

        iloc equ imp+462
        istep equ 267

clr:	spl # 741,< 399
	mov {-1,<-1
	mov <-2,{-2
	djn.f -2,{ 168
for 8
	dat 0,0
rof
start:	mov imp,iloc
clgo:	spl clr	,{0
	spl 1		,}iloc+(6*istep)
	spl 1		,}iloc+(4*istep)
	spl 2		,}iloc+(2*istep)
first:	djn.a >first	,#iloc+(0*istep)
	djn.a @first+1	,#iloc+(1*istep)
imp:	mov.i #istep,*0

end start
