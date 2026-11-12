;redcode-nano
;name Steaming Pebbles
;author Terry Newton
;strategy evolved by mevo, gen 2591
;strategy nanobm07=153, nanob2=156
;generation 2591
;species 9422
;origin 58_12
;assert CORESIZE==80
mov    >-29,$22
spl.i  #-6,>-38
mov.i  <-1,{-1
mov    {-2,<-2
djn.x  $-2,<-27
end
;benchscore 153.07 (nanobm07 142 rounds)
