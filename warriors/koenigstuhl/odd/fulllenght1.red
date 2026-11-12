;redcode-94x
;author Roy van Rijn
;name FullLenght1
;strategy Didn't know about the size rules :)
;assert 1

start1   mov <314,<702
start2   mov >522,>173
start3   mov {624,>372
start4   mov }773,>567
start5   mov <295,>526
start6   mov >483,>743
start7   mov >452,<734
start8   mov <123,}142
start9   mov {542,}413
start10  mov >512,{244
start11         mov <622,>241
start12  mov >145,10
start13  mov >352,<241
start14  spl #0,>253
start15  mov nostart,>start12
start16  djn.f 1,>start12
start17  sub.a #2,-1
start18 mov start12,-1
start19 jmp start14
nostart dat <267,#15

end start1
