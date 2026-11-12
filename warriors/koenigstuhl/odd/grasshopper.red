;redcode-94m
;name grasshopper
;author simon wainwright
;strategy clear
;assert 1

org clear

gate dat <2667, 200
dat 0,0

dat 0,0
spl #0,<500
mov bmob,>gate
djn.f -1,>gate
clear spl -3,<4000
spl #0,<-500
mov bomb,>gate
djn.f -1,>gate

dat <2667,<15
bomb dat <2667,<15
bmob dat <2667,<15
dat <2667,<15
