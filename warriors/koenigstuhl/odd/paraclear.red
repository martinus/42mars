;redcode-94nop
;name ParaClear
;author Roy van Rijn
;strategy IRCT10
;assert 1

start spl 0,>2
      spl para2,>412
para1 spl <0,-20
      djn.f -1,<-1
      dat 0,0
      dat 0,0
      dat 0,0
      dat 0,0
      dat 0,0
      dat 0,0
      dat 0,0
      dat 0,0
      dat 0,0
para2 spl <0,400
      djn.f -1,<-1
end start
