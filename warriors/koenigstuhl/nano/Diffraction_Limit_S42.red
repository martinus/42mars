;redcode-nano
;name Diffraction Limit S42
;author inversed
;strategy Scanner
;date 2022.09.18
;assert CORESIZE == 80

org     1

sub     #-42 , # 47
jmz.f     -1 , @ -1
mov        2 , > -2
djn.f     -2 , { 38
mov.i   #  5 ,   -1
