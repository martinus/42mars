;redcode
;name AntiDeathStar
;author Lukasz Adamowski
;assert 1

start jmz.b #0, >MAXLENGTH
mov $3, <MAXLENGTH-1
spl $0, $0
spl $-1, $0

end start

